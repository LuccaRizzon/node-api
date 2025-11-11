import { AppDataSource } from "../data-source";
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
        const queryRunner = AppDataSource.createQueryRunner();
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

            const vendaCompleta = await AppDataSource.manager.findOne(Venda, {
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
        const pageNumber = filtros.page || 1;
        const limitNumber = filtros.limit || 10;
        const skip = (pageNumber - 1) * limitNumber;

        const queryBuilder = AppDataSource.manager
            .getRepository(Venda)
            .createQueryBuilder("venda")
            .leftJoinAndSelect("venda.itens", "item")
            .leftJoinAndSelect("item.produto", "produto");

        if (filtros.dataInicio && filtros.dataFim) {
            queryBuilder.where("venda.dataHora >= :dataInicio", { dataInicio: filtros.dataInicio })
                .andWhere("venda.dataHora <= :dataFim", { dataFim: filtros.dataFim });
        }

        const [vendas, total] = await queryBuilder
            .skip(skip)
            .take(limitNumber)
            .orderBy("venda.dataHora", "DESC")
            .getManyAndCount();

        const totalizadores = await AppDataSource.manager
            .getRepository(Venda)
            .createQueryBuilder("venda")
            .select("SUM(venda.valorTotal)", "valorTotal")
            .addSelect("COUNT(venda.id)", "numeroVendas")
            .leftJoin("venda.itens", "item")
            .addSelect("SUM(item.quantidade)", "quantidadeItens")
            .where(filtros.dataInicio && filtros.dataFim ? "venda.dataHora >= :dataInicio AND venda.dataHora <= :dataFim" : "1=1", { dataInicio: filtros.dataInicio, dataFim: filtros.dataFim })
            .getRawOne();

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
        const venda = await AppDataSource.manager.findOne(Venda, {
            where: { id },
            relations: ["itens", "itens.produto"]
        });

        if (!venda) {
            throw new Error("Sale not found");
        }

        return venda;
    }

    async update(id: number, dto: AtualizarVendaDTO): Promise<Venda> {
        const queryRunner = AppDataSource.createQueryRunner();
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

            const vendaCompleta = await AppDataSource.manager.findOne(Venda, {
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
        const queryRunner = AppDataSource.createQueryRunner();
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

