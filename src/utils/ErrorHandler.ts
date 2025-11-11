import { Response } from "express";

export class ErrorHandler {
    private static getErrorMessage(error: any): string {
        if (error instanceof Error) {
            return error.message;
        }
        if (error?.message) {
            return error.message;
        }
        return String(error);
    }

    private static isNotFoundError(errorMessage: string): boolean {
        const lowerMessage = errorMessage.toLowerCase();
        return lowerMessage.includes("not found");
    }

    private static isProductError(errorMessage: string): boolean {
        const lowerMessage = errorMessage.toLowerCase();
        return lowerMessage.includes("product");
    }

    private static isFinishedStatusError(errorMessage: string): boolean {
        return errorMessage.toLowerCase().includes("finished status");
    }

    private static isDuplicateError(error: any): boolean {
        return error?.code === 'ER_DUP_ENTRY' || error?.errno === 1062;
    }

    private static extractDuplicateField(errorMessage: string): string | null {
        const match = errorMessage.match(/Duplicate entry '([^']+)'/i);

        if (match && match[1]) {
            return match[1];
        }

        return null;
    }

    static handleError(res: Response, error: any, defaultMessage: string, defaultStatus: number = 500): Response {
        const errorMessage = this.getErrorMessage(error);

        // Handle duplicate entry errors (422 Unprocessable Entity - OWASP)
        if (this.isDuplicateError(error)) {
            const duplicateValue = this.extractDuplicateField(errorMessage);
            const message = duplicateValue 
                ? `A sale with code '${duplicateValue}' already exists`
                : "Duplicate entry: This record already exists";
            
            return res.status(422).json({
                error: message
            });
        }

        if (this.isFinishedStatusError(errorMessage)) {
            return res.status(422).json({ 
                error: errorMessage 
            });
        }

        if (this.isProductError(errorMessage)) {
            return res.status(400).json({ 
                error: errorMessage 
            });
        }

        if (this.isNotFoundError(errorMessage)) {
            return res.status(404).json({ 
                error: errorMessage 
            });
        }

        return res.status(defaultStatus).json({ 
            error: defaultMessage,
            details: errorMessage 
        });
    }

    static badRequest(res: Response, message: string, customError?: string): Response {
        return res.status(400).json({
            error: customError || message
        });
    }

    static notFound(res: Response, message: string = "Resource not found"): Response {
        return res.status(404).json({
            error: "Not found",
            message
        });
    }

    static internalServerError(res: Response, message: string = "Internal server error"): Response {
        return res.status(500).json({
            error: "Internal server error",
            message
        });
    }

    static unprocessableEntity(res: Response, message: string): Response {
        return res.status(422).json({
            error: message
        });
    }
}

