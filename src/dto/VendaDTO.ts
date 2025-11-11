import { Venda } from "../entity/Venda";
import { VendaItem } from "../entity/VendaItem";

export interface VendaItemProdutoDTO {
    id: number;
    nome?: string;
    preco?: number;
}

export interface VendaItemDTO {
    id: number;
    produtoId: number;
    quantidade: number;
    precoUnitario: number;
    descontoItem: number;
    valorTotal: number;
    produto?: VendaItemProdutoDTO;
}

const mapVendaItem = (item: VendaItem): VendaItemDTO => {
    const produtoId = item.produto?.id ?? (item as any).produtoId ?? 0;

    return {
        id: item.id,
        produtoId,
        quantidade: item.quantidade,
        precoUnitario: Number(item.precoUnitario),
        descontoItem: Number(item.descontoItem),
        valorTotal: Number(item.valorTotal),
        produto: item.produto
            ? {
                id: item.produto.id,
                nome: item.produto.nome,
                preco: Number(item.produto.preco)
            }
            : produtoId
                ? { id: produtoId }
                : undefined
    };
};

export const toVendaDTO = (venda: Venda) => ({
    id: venda.id,
    codigo: venda.codigo,
    dataHora: venda.dataHora,
    nomeCliente: venda.nomeCliente,
    descontoVenda: Number(venda.descontoVenda),
    valorTotal: Number(venda.valorTotal),
    status: venda.status,
    itens: venda.itens?.map(mapVendaItem) ?? [],
});


