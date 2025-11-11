import { getDataSource } from "../utils/getDataSource";
import { Venda, StatusVenda } from "../entity/Venda";
import { VendaItem } from "../entity/VendaItem";
import { ProductCache } from "../utils/ProductCache";

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

export interface ListarVendasResultado {
    vendas: Venda[];
    paginacao: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
    totalizadores: {
        valorTotal: number;
        numeroVendas: number;
        quantidadeItens: number;
    };
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

    async create(dto: CriarVendaDTO): Promise<Venda> {
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
            await queryRunner.manager.save(VendaItem, vendaItens);

            await queryRunner.commitTransaction();

            const vendaCompleta = await dataSource.manager.findOne(Venda, {
                where: { id: vendaSalva.id },
                relations: ["itens", "itens.produto"]
            });

            return vendaCompleta!;
        } catch (error) {
            await queryRunner.rollbackTransaction().catch(() => {});
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    async list(filtros: ListarVendasFiltros): Promise<ListarVendasResultado> {
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

        if (filtros.search && filtros.search.trim().length > 0) {
            const searchTerm = `%${filtros.search.trim().toLowerCase()}%`;
            whereConditions.push(
                "(LOWER(venda.codigo) LIKE :search OR LOWER(venda.nomeCliente) LIKE :search OR LOWER(venda.status) LIKE :search)"
            );
            queryParams.search = searchTerm;
        }

        if (whereConditions.length > 0) {
            queryBuilder.where(whereConditions.join(" AND "), queryParams);
        }

        const [vendas, total] = await queryBuilder
            .skip(skip)
            .take(limitNumber)
            .orderBy("venda.dataHora", "DESC")
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
            vendas,
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

    async findById(id: number): Promise<Venda> {
        const dataSource = getDataSource();
        const venda = await dataSource.manager.findOne(Venda, {
            where: { id },
            relations: ["itens", "itens.produto"]
        });

        if (!venda) {
            throw new Error("Sale not found");
        }

        return venda;
    }

    async update(id: number, dto: AtualizarVendaDTO): Promise<Venda> {
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
                venda.itens = vendaItens;

                await queryRunner.manager.save(VendaItem, vendaItens);
            } else if (dto.descontoVenda !== undefined) {
                venda.descontoVenda = dto.descontoVenda;
                if (venda.itens && venda.itens.length > 0) {
                    this.calcularDescontoItens(venda.itens, dto.descontoVenda);
                    venda.valorTotal = venda.itens.reduce((sum, item) => sum + item.valorTotal, 0);
                    await queryRunner.manager.save(VendaItem, venda.itens);
                }
            }

            const vendaAtualizada = await queryRunner.manager.save(Venda, venda);
            await queryRunner.commitTransaction();

            const vendaCompleta = await dataSource.manager.findOne(Venda, {
                where: { id: vendaAtualizada.id },
                relations: ["itens", "itens.produto"]
            });

            return vendaCompleta!;
        } catch (error) {
            await queryRunner.rollbackTransaction().catch(() => {});
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

