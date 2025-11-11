import { getDataSource } from "../utils/getDataSource";
import { Venda, StatusVenda } from "../entity/Venda";
import { VendaItem } from "../entity/VendaItem";
import { ProductCache } from "../utils/ProductCache";
import { toVendaDTO } from "../dto/VendaDTO";

export interface CriarVendaDTO {
    codigo: string;
    nomeCliente: string;
    descontoVenda?: number;
    itens: CriarVendaItemDTO[];
    status?: StatusVenda;
}

export interface CriarVendaItemDTO {
    produtoId: number;
    quantidade: number;
    precoUnitario: number;
    descontoItem?: number;
}

export interface AtualizarVendaDTO {
    codigo?: string;
    nomeCliente?: string;
    descontoVenda?: number;
    itens?: CriarVendaItemDTO[];
    status?: StatusVenda;
}

export interface ListarVendasFiltros {
    dataInicio?: string;
    dataFim?: string;
    page?: number;
    limit?: number;
    search?: string;
}

export class VendaService {
    private calcularDescontoItens(vendaItens: VendaItem[], descontoVenda: number): void {
        const totalSemDesconto = vendaItens.reduce((sum, item) => {
            return sum + (item.quantidade * item.precoUnitario);
        }, 0);

        vendaItens.forEach(item => {
            const valorItemSemDesconto = item.quantidade * item.precoUnitario;
            const proporcao = valorItemSemDesconto / totalSemDesconto;
            item.descontoItem = descontoVenda * proporcao;
            item.valorTotal = valorItemSemDesconto - item.descontoItem;
        });
    }

    private calcularTotais(venda: Venda, vendaItens: VendaItem[]): void {
        if (venda.descontoVenda && venda.descontoVenda > 0) {
            this.calcularDescontoItens(vendaItens, venda.descontoVenda);
        } else {
            const totalDescontoItens = vendaItens.reduce((sum, item) => sum + (item.descontoItem || 0), 0);
            venda.descontoVenda = totalDescontoItens;
        }

        venda.valorTotal = vendaItens.reduce((sum, item) => sum + item.valorTotal, 0);
    }

    async create(dto: CriarVendaDTO) {
        const dataSource = getDataSource();
        const queryRunner = dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const venda = new Venda();
            venda.codigo = dto.codigo;
            venda.nomeCliente = dto.nomeCliente;
            venda.descontoVenda = dto.descontoVenda || 0;
            venda.status = dto.status || StatusVenda.ABERTA;

            const vendaItens: VendaItem[] = [];

            for (const item of dto.itens) {
                const produto = await ProductCache.get(item.produtoId, queryRunner);
                if (!produto) {
                    await queryRunner.rollbackTransaction();
                    throw new Error(`Product with ID ${item.produtoId} not found`);
                }

                const vendaItem = new VendaItem();
                vendaItem.venda = venda;
                vendaItem.produto = produto;
                vendaItem.quantidade = item.quantidade;
                vendaItem.precoUnitario = item.precoUnitario;
                vendaItem.descontoItem = item.descontoItem || 0;

                const valorItem = vendaItem.quantidade * vendaItem.precoUnitario;
                vendaItem.valorTotal = valorItem - vendaItem.descontoItem;

                vendaItens.push(vendaItem);
            }

            this.calcularTotais(venda, vendaItens);
            venda.itens = vendaItens;

            const vendaSalva = await queryRunner.manager.save(Venda, venda);
            const itensSalvos = await queryRunner.manager.save(VendaItem, vendaItens);
            vendaSalva.itens = itensSalvos;

            await queryRunner.commitTransaction();

            return toVendaDTO(vendaSalva);
        } catch (error: any) {
            await queryRunner.rollbackTransaction().catch(() => {});
            console.error("Error creating sale:", error);
            // Attach the codigo to the error for better duplicate error messages
            // Database-agnostic: check for any unique constraint violation
            const errorMessage = error?.message || '';
            if (error && (error.code === 'ER_DUP_ENTRY' || error.errno === 1062 || 
                errorMessage.includes('UNIQUE constraint') ||
                errorMessage.includes('duplicate key') ||
                errorMessage.includes('unique constraint'))) {
                error.duplicateField = 'codigo';
                error.duplicateValue = dto.codigo;
            }
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

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

    async findById(id: number) {
        const dataSource = getDataSource();
        const venda = await dataSource.manager.findOne(Venda, {
            where: { id },
            relations: ["itens", "itens.produto"]
        });

        if (!venda) {
            throw new Error("Sale not found");
        }

        return toVendaDTO(venda);
    }

    async update(id: number, dto: AtualizarVendaDTO) {
        const dataSource = getDataSource();
        const queryRunner = dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const venda = await queryRunner.manager.findOne(Venda, {
                where: { id },
                relations: ["itens"]
            });

            if (!venda) {
                await queryRunner.rollbackTransaction();
                throw new Error("Sale not found");
            }

            if (venda.status === StatusVenda.CONCLUIDA) {
                await queryRunner.rollbackTransaction();
                throw new Error("Cannot update a sale with status 'Concluída'. This is a finished status.");
            }

            if (dto.codigo) venda.codigo = dto.codigo;
            if (dto.nomeCliente) venda.nomeCliente = dto.nomeCliente;
            if (dto.status) venda.status = dto.status;

            if (dto.itens && Array.isArray(dto.itens) && dto.itens.length > 0) {
                await queryRunner.manager.remove(VendaItem, venda.itens);

                const vendaItens: VendaItem[] = [];

                for (const item of dto.itens) {
                    const produto = await ProductCache.get(item.produtoId, queryRunner);
                    if (!produto) {
                        await queryRunner.rollbackTransaction();
                        throw new Error(`Product with ID ${item.produtoId} not found`);
                    }

                    const vendaItem = new VendaItem();
                    vendaItem.venda = venda;
                    vendaItem.produto = produto;
                    vendaItem.quantidade = item.quantidade;
                    vendaItem.precoUnitario = item.precoUnitario;
                    vendaItem.descontoItem = item.descontoItem || 0;

                    const valorItem = vendaItem.quantidade * vendaItem.precoUnitario;
                    vendaItem.valorTotal = valorItem - vendaItem.descontoItem;

                    vendaItens.push(vendaItem);
                }

                if (dto.descontoVenda !== undefined && dto.descontoVenda > 0) {
                    this.calcularDescontoItens(vendaItens, dto.descontoVenda);
                    venda.descontoVenda = dto.descontoVenda;
                } else if (dto.descontoVenda === 0) {
                    venda.descontoVenda = 0;
                } else {
                    const totalDescontoItens = vendaItens.reduce((sum, item) => sum + (item.descontoItem || 0), 0);
                    venda.descontoVenda = totalDescontoItens;
                }

                venda.valorTotal = vendaItens.reduce((sum, item) => sum + item.valorTotal, 0);
                const itensAtualizados = await queryRunner.manager.save(VendaItem, vendaItens);
                venda.itens = itensAtualizados;
            } else if (dto.descontoVenda !== undefined) {
                venda.descontoVenda = dto.descontoVenda;
                if (venda.itens && venda.itens.length > 0) {
                    this.calcularDescontoItens(venda.itens, dto.descontoVenda);
                    venda.valorTotal = venda.itens.reduce((sum, item) => sum + item.valorTotal, 0);
                    await queryRunner.manager.save(VendaItem, venda.itens);
                }
            }

            const vendaAtualizada = await queryRunner.manager.save(Venda, venda);
            // ensure itens reference latest venda state
            vendaAtualizada.itens = venda.itens;

            await queryRunner.commitTransaction();

            return toVendaDTO(vendaAtualizada);
        } catch (error) {
            await queryRunner.rollbackTransaction().catch(() => {});
            console.error("Error updating sale:", error);
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

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
                await queryRunner.rollbackTransaction();
                throw new Error("Sale not found");
            }

            if (venda.status === StatusVenda.CONCLUIDA) {
                await queryRunner.rollbackTransaction();
                throw new Error("Cannot delete a sale with status 'Concluída'. This is a finished status.");
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
}

