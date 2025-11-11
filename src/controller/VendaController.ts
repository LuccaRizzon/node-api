import { Request, Response } from "express";
import { VendaService } from "../service/VendaService";
import { ErrorHandler } from "../utils/ErrorHandler";

export class VendaController {
    private vendaService: VendaService;

    constructor() {
        this.vendaService = new VendaService();
    }

    async create(req: Request, res: Response) {
        try {
            const { codigo, nomeCliente, descontoVenda, itens, status } = req.body;

            const venda = await this.vendaService.create({
                codigo,
                nomeCliente,
                descontoVenda,
                itens,
                status
            });

            return res.status(201).json(venda);
        } catch (error: any) {
            return ErrorHandler.handleError(res, error, "Failed to create sale");
        }
    }

    async list(req: Request, res: Response) {
        try {
            const { dataInicio, dataFim, page, limit, search } = req.query;

            const resultado = await this.vendaService.list({
                dataInicio: dataInicio as string,
                dataFim: dataFim as string,
                page: page ? parseInt(page as string) : undefined,
                limit: limit ? parseInt(limit as string) : undefined,
                search: search as string
            });

            return res.status(200).json(resultado);
        } catch (error: any) {
            return ErrorHandler.handleError(res, error, "Failed to list sales");
        }
    }

    async findById(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const idNum = parseInt(id);
            const venda = await this.vendaService.findById(idNum);

            return res.status(200).json(venda);
        } catch (error: any) {
            return ErrorHandler.handleError(res, error, "Failed to find sale");
        }
    }

    async update(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const idNum = parseInt(id);
            const { codigo, nomeCliente, descontoVenda, itens, status } = req.body;

            const venda = await this.vendaService.update(idNum, {
                codigo,
                nomeCliente,
                descontoVenda,
                itens,
                status
            });

            return res.status(200).json(venda);
        } catch (error: any) {
            return ErrorHandler.handleError(res, error, "Failed to update sale");
        }
    }

    async delete(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const idNum = parseInt(id);
            await this.vendaService.delete(idNum);

            return res.status(204).send();
        } catch (error: any) {
            return ErrorHandler.handleError(res, error, "Failed to delete sale");
        }
    }
}

