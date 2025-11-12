import { getDataSource } from "../utils/getDataSource";
import { Venda, StatusVenda } from "../entity/Venda";
import { VendaItem } from "../entity/VendaItem";
import { ProductCache } from "../utils/ProductCache";
import { toVendaDTO } from "../dto/VendaDTO";
import { AtualizarVendaDTO, CriarVendaDTO, CriarVendaItemDTO, ListarVendasFiltros } from "../dto/VendaInputDTO";
import { calculateSaleTotals, SaleCalculationRequest } from "./saleCalculations";
import { AppError, businessRuleError, conflictError, notFoundError } from "../utils/AppError";
import { ZERO, roundMoney } from "../utils/money";

const STATUS_TRANSITIONS: Record<StatusVenda, StatusVenda[]> = {
    [StatusVenda.ABERTA]: [StatusVenda.CONCLUIDA, StatusVenda.CANCELADA],
    [StatusVenda.CONCLUIDA]: [],
    [StatusVenda.CANCELADA]: []
};

const isAllowedStatusTransition = (current: StatusVenda, next?: StatusVenda): boolean => {
    if (!next || current === next) {
        return true;
    }
    return STATUS_TRANSITIONS[current]?.includes(next) ?? false;
};

export class VendaService {
    /**
     * Creates a new sale using transactional persistence and precise monetary calculations.
     *
     * @param dto Payload for creating a sale
     * @returns VendaDTO representation of the created sale
     * @throws AppError when business rules or database constraints are violated
     */
    async create(dto: CriarVendaDTO) {
        const dataSource = getDataSource();
        const queryRunner = dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const venda = new Venda();
            venda.codigo = dto.codigo;
            venda.nomeCliente = dto.nomeCliente;
            venda.descontoVenda = roundMoney(dto.descontoVenda ?? ZERO);
            venda.status = dto.status || StatusVenda.ABERTA;

            const vendaItens: VendaItem[] = [];
            const calculationRequest: SaleCalculationRequest = {
                descontoVenda: dto.descontoVenda ?? ZERO,
                itens: []
            };

            const uniqueProdutoIds = Array.from(new Set(dto.itens.map(item => item.produtoId)));
            const produtosMap = await ProductCache.getMany(uniqueProdutoIds, queryRunner);

            for (let index = 0; index < dto.itens.length; index++) {
                const item = dto.itens[index];
                const produto = produtosMap.get(item.produtoId);
                if (!produto) {
                    throw notFoundError(
                        `Product with ID ${item.produtoId} was not found.`,
                        "PRODUCT_NOT_FOUND",
                        {
                            errors: [
                                {
                                    field: `itens[${index}].produtoId`,
                                    message: `Product with ID ${item.produtoId} was not found.`
                                }
                            ]
                        }
                    );
                }

                const vendaItem = new VendaItem();
                vendaItem.venda = venda;
                vendaItem.produto = produto;
                vendaItem.quantidade = item.quantidade;
                vendaItens.push(vendaItem);

                calculationRequest.itens.push({
                    produtoId: produto.id,
                    quantidade: item.quantidade,
                    precoUnitario: item.precoUnitario,
                    descontoItem: item.descontoItem ?? ZERO
                });
            }

            const calculation = calculateSaleTotals(calculationRequest);
            venda.descontoVenda = calculation.descontoVenda;
            venda.valorTotal = calculation.valorTotal;
            venda.itens = vendaItens;

            calculation.itens.forEach((calcItem, index) => {
                const item = vendaItens[index];
                item.precoUnitario = calcItem.precoUnitario;
                item.descontoItem = calcItem.descontoItem;
                item.valorTotal = calcItem.valorTotal;
            });

            const vendaSalva = await queryRunner.manager.save(Venda, venda);
            const itensSalvos = await queryRunner.manager.save(VendaItem, vendaItens);
            vendaSalva.itens = itensSalvos;

            await queryRunner.commitTransaction();

            return toVendaDTO(vendaSalva);
        } catch (error: any) {
            await queryRunner.rollbackTransaction().catch(() => {});

            if (this.isDuplicateError(error)) {
                throw conflictError(
                    `Sale code '${dto.codigo}' already exists.`,
                    "SALE_CODE_EXISTS",
                    {
                        errors: [
                            {
                                field: "codigo",
                                message: `Sale code '${dto.codigo}' already exists.`
                            }
                        ]
                    }
                );
            }

            if (error instanceof AppError) {
                throw error;
            }

            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Retrieves a paginated list of sales with optional date range and search filters.
     */
    async list(filtros: ListarVendasFiltros) {
        const dataSource = getDataSource();
        const pageNumber = filtros.page || 1;
        const limitNumber = filtros.limit || 10;
        const skip = (pageNumber - 1) * limitNumber;

        const queryBuilder = dataSource.manager
            .getRepository(Venda)
            .createQueryBuilder("venda")
            .leftJoinAndSelect("venda.itens", "item")
            .leftJoinAndSelect("item.produto", "produto");

        const whereConditions: string[] = [];
        const queryParams: any = {};

        if (filtros.dataInicio && filtros.dataFim) {
            whereConditions.push("venda.dataHora >= :dataInicio");
            whereConditions.push("venda.dataHora <= :dataFim");
            queryParams.dataInicio = filtros.dataInicio;
            queryParams.dataFim = filtros.dataFim;
        }

        let orderedByRelevance = false;

        const datasourceType = (dataSource.options as any)?.type?.toString().toLowerCase?.() || '';
        const supportsFullText = ["mysql", "mariadb"].includes(datasourceType);

        if (filtros.search && filtros.search.trim().length > 0) {
            const rawTerms = filtros.search.trim().split(/\s+/).map(term => term.trim());
            const sanitizedTerms = rawTerms
                .map(term => term.replace(/[^0-9A-Za-zÀ-ÿ]/g, ""))
                .filter(term => term.length > 0);

            const canUseFullText = supportsFullText && sanitizedTerms.some(term => term.length >= 3);

            if (canUseFullText) {
                const booleanSearch = sanitizedTerms.map(term => `${term}*`).join(" ");
                whereConditions.push(
                    "MATCH(venda.codigo, venda.nomeCliente) AGAINST (:searchBoolean IN BOOLEAN MODE)"
                );
                queryParams.searchBoolean = booleanSearch;
                queryBuilder.addSelect(
                    "MATCH(venda.codigo, venda.nomeCliente) AGAINST (:searchBoolean IN BOOLEAN MODE)",
                    "relevance"
                );
                orderedByRelevance = true;
            } else {
                const searchTerm = `%${filtros.search.trim().toLowerCase()}%`;
                whereConditions.push(
                    "(LOWER(venda.codigo) LIKE :searchLike OR LOWER(venda.nomeCliente) LIKE :searchLike OR LOWER(venda.status) LIKE :searchLike)"
                );
                queryParams.searchLike = searchTerm;
            }
        }

        if (whereConditions.length > 0) {
            queryBuilder.where(whereConditions.join(" AND "), queryParams);
        }

        if (orderedByRelevance) {
            queryBuilder.orderBy("relevance", "DESC").addOrderBy("venda.dataHora", "DESC");
        } else {
            queryBuilder.orderBy("venda.dataHora", "DESC");
        }

        const [vendas, total] = await queryBuilder
            .skip(skip)
            .take(limitNumber)
            .getManyAndCount();

        const totalizadoresQueryBuilder = dataSource.manager
            .getRepository(Venda)
            .createQueryBuilder("venda")
            .select("SUM(venda.valorTotal)", "valorTotal")
            .addSelect("COUNT(venda.id)", "numeroVendas")
            .leftJoin("venda.itens", "item")
            .addSelect("SUM(item.quantidade)", "quantidadeItens");

        if (whereConditions.length > 0) {
            totalizadoresQueryBuilder.where(whereConditions.join(" AND "), queryParams);
        }

        const totalizadores = await totalizadoresQueryBuilder.getRawOne();

        return {
            vendas: vendas.map(toVendaDTO),
            paginacao: {
                page: pageNumber,
                limit: limitNumber,
                total,
                totalPages: Math.ceil(total / limitNumber)
            },
            totalizadores: {
                valorTotal: parseFloat(totalizadores.valorTotal || 0),
                numeroVendas: parseInt(totalizadores.numeroVendas || 0),
                quantidadeItens: parseInt(totalizadores.quantidadeItens || 0)
            }
        };
    }

    /**
     * Finds a sale by ID.
     */
    async findById(id: number) {
        const dataSource = getDataSource();
        const venda = await dataSource.manager.findOne(Venda, {
            where: { id },
            relations: ["itens", "itens.produto"]
        });

        if (!venda) {
            throw notFoundError("Sale not found.", "SALE_NOT_FOUND");
        }

        return toVendaDTO(venda);
    }

    /**
     * Updates a sale and its items ensuring transactional integrity.
     */
    async update(id: number, dto: AtualizarVendaDTO) {
        const dataSource = getDataSource();
        const queryRunner = dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const venda = await queryRunner.manager.findOne(Venda, {
                where: { id },
                relations: ["itens", "itens.produto"]
            });

            if (!venda) {
                throw notFoundError("Sale not found.", "SALE_NOT_FOUND");
            }

            if (venda.status === StatusVenda.CONCLUIDA) {
                throw businessRuleError(
                    "Cannot update a sale with status 'Concluída'.",
                    "SALE_FINALIZED"
                );
            }

            if (dto.codigo) {
                venda.codigo = dto.codigo;
            }

            if (dto.nomeCliente) {
                venda.nomeCliente = dto.nomeCliente;
            }

            if (dto.status) {
                if (!isAllowedStatusTransition(venda.status, dto.status)) {
                    throw businessRuleError(
                        `Invalid status transition from '${venda.status}' to '${dto.status}'.`,
                        "INVALID_STATUS_TRANSITION"
                    );
                }
                venda.status = dto.status;
            }

            if (dto.itens && Array.isArray(dto.itens) && dto.itens.length > 0) {
                const uniqueProdutoIds = Array.from(new Set(dto.itens.map(item => item.produtoId)));
                const produtosMap = await ProductCache.getMany(uniqueProdutoIds, queryRunner);

                await queryRunner.manager.remove(VendaItem, venda.itens);

                const vendaItens: VendaItem[] = [];
                const calculationRequest: SaleCalculationRequest = {
                    descontoVenda: dto.descontoVenda ?? ZERO,
                    itens: []
                };

                for (let index = 0; index < dto.itens.length; index++) {
                    const item = dto.itens[index];
                    const produto = produtosMap.get(item.produtoId);
                    if (!produto) {
                        throw notFoundError(
                            `Product with ID ${item.produtoId} was not found.`,
                            "PRODUCT_NOT_FOUND",
                            {
                                errors: [
                                    {
                                        field: `itens[${index}].produtoId`,
                                        message: `Product with ID ${item.produtoId} was not found.`
                                    }
                                ]
                            }
                        );
                    }

                    const vendaItem = new VendaItem();
                    vendaItem.venda = venda;
                    vendaItem.produto = produto;
                    vendaItem.quantidade = item.quantidade;
                    vendaItens.push(vendaItem);

                    calculationRequest.itens.push({
                        produtoId: produto.id,
                        quantidade: item.quantidade,
                        precoUnitario: item.precoUnitario,
                        descontoItem: item.descontoItem ?? ZERO
                    });
                }

                const calculation = calculateSaleTotals(calculationRequest);
                venda.descontoVenda = calculation.descontoVenda;
                venda.valorTotal = calculation.valorTotal;
                calculation.itens.forEach((calcItem, index) => {
                    const item = vendaItens[index];
                    item.precoUnitario = calcItem.precoUnitario;
                    item.descontoItem = calcItem.descontoItem;
                    item.valorTotal = calcItem.valorTotal;
                });
                const itensAtualizados = await queryRunner.manager.save(VendaItem, vendaItens);
                venda.itens = itensAtualizados;
            } else if (dto.descontoVenda !== undefined) {
                const calculation = calculateSaleTotals({
                    descontoVenda: dto.descontoVenda ?? ZERO,
                    itens: venda.itens.map((item) => ({
                        produtoId: item.produto?.id,
                        quantidade: item.quantidade,
                        precoUnitario: item.precoUnitario,
                        descontoItem: item.descontoItem
                    }))
                });

                venda.descontoVenda = calculation.descontoVenda;
                venda.valorTotal = calculation.valorTotal;

                calculation.itens.forEach((calcItem, index) => {
                    const item = venda.itens[index];
                    item.descontoItem = calcItem.descontoItem;
                    item.valorTotal = calcItem.valorTotal;
                });

                await queryRunner.manager.save(VendaItem, venda.itens);
            }

            const vendaAtualizada = await queryRunner.manager.save(Venda, venda);
            // ensure itens reference latest venda state
            vendaAtualizada.itens = venda.itens;

            await queryRunner.commitTransaction();

            return toVendaDTO(vendaAtualizada);
        } catch (error: any) {
            await queryRunner.rollbackTransaction().catch(() => {});

            if (this.isDuplicateError(error) && dto.codigo) {
                throw conflictError(
                    `Sale code '${dto.codigo}' already exists.`,
                    "SALE_CODE_EXISTS",
                    {
                        errors: [
                            {
                                field: "codigo",
                                message: `Sale code '${dto.codigo}' already exists.`
                            }
                        ]
                    }
                );
            }

            if (error instanceof AppError) {
                throw error;
            }

            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Deletes a sale using a transaction and business-rule validation.
     */
    async delete(id: number): Promise<void> {
        const dataSource = getDataSource();
        const queryRunner = dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const venda = await queryRunner.manager.findOne(Venda, {
                where: { id }
            });

            if (!venda) {
                throw notFoundError("Sale not found.", "SALE_NOT_FOUND");
            }

            if (venda.status === StatusVenda.CONCLUIDA) {
                throw businessRuleError(
                    "Cannot delete a sale with status 'Concluída'.",
                    "SALE_FINALIZED"
                );
            }

            await queryRunner.manager.remove(Venda, venda);
            await queryRunner.commitTransaction();
        } catch (error) {
            await queryRunner.rollbackTransaction().catch(() => {});
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    private isDuplicateError(error: any): boolean {
        return error?.code === "ER_DUP_ENTRY" ||
            error?.errno === 1062 ||
            (typeof error?.message === "string" &&
                (
                    error.message.includes("UNIQUE constraint") ||
                    error.message.includes("duplicate key") ||
                    error.message.includes("unique constraint")
                ));
    }
}

