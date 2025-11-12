import { StatusVenda } from "../entity/Venda";

export interface CriarVendaItemDTO {
    produtoId: number;
    quantidade: number;
    precoUnitario: number;
    descontoItem?: number;
}

export interface CriarVendaDTO {
    codigo: string;
    nomeCliente: string;
    descontoVenda?: number;
    itens: CriarVendaItemDTO[];
    status?: StatusVenda;
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


