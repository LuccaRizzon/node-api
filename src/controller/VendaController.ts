import { Request, Response } from "express";
import { VendaService } from "../service/VendaService";
import { ErrorHandler } from "../utils/ErrorHandler";

export class VendaController {
    private vendaService: VendaService;

    constructor() {
        this.vendaService = new VendaService();
    }

    private validateCreateRequest(body: any): { isValid: boolean; error?: string } {
        const { codigo, nomeCliente, itens } = body;

        if (!codigo || typeof codigo !== 'string' || codigo.trim().length === 0) {
            return { isValid: false, error: "Field 'codigo' is required and must be a non-empty string" };
        }

        if (!nomeCliente || typeof nomeCliente !== 'string' || nomeCliente.trim().length === 0) {
            return { isValid: false, error: "Field 'nomeCliente' is required and must be a non-empty string" };
        }

        if (!itens) {
            return { isValid: false, error: "Field 'itens' is required" };
        }

        if (!Array.isArray(itens)) {
            return { isValid: false, error: "Field 'itens' must be an array" };
        }

        if (itens.length === 0) {
            return { isValid: false, error: "Field 'itens' must contain at least one item" };
        }

        // Validate each item structure
        for (let i = 0; i < itens.length; i++) {
            const item = itens[i];
            if (!item.produtoId || typeof item.produtoId !== 'number') {
                return { isValid: false, error: `Item at index ${i}: 'produtoId' is required and must be a number` };
            }
            if (!item.quantidade || typeof item.quantidade !== 'number' || item.quantidade <= 0) {
                return { isValid: false, error: `Item at index ${i}: 'quantidade' is required and must be a positive number` };
            }
            if (item.precoUnitario === undefined || typeof item.precoUnitario !== 'number' || item.precoUnitario < 0) {
                return { isValid: false, error: `Item at index ${i}: 'precoUnitario' is required and must be a non-negative number` };
            }
        }

        return { isValid: true };
    }

    async create(req: Request, res: Response) {
        try {
            const validation = this.validateCreateRequest(req.body);
            if (!validation.isValid) {
                return ErrorHandler.badRequest(res, validation.error!);
            }

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
            const { dataInicio, dataFim, page, limit } = req.query;

            const resultado = await this.vendaService.list({
                dataInicio: dataInicio as string,
                dataFim: dataFim as string,
                page: page ? parseInt(page as string) : undefined,
                limit: limit ? parseInt(limit as string) : undefined
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
            if (isNaN(idNum)) {
                return ErrorHandler.badRequest(res, "ID must be a valid number");
            }
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
            if (isNaN(idNum)) {
                return ErrorHandler.badRequest(res, "ID must be a valid number");
            }
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
            if (isNaN(idNum)) {
                return ErrorHandler.badRequest(res, "ID must be a valid number");
            }
            await this.vendaService.delete(idNum);

            return res.status(204).send();
        } catch (error: any) {
            return ErrorHandler.handleError(res, error, "Failed to delete sale");
        }
    }
}

