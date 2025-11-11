import { Response } from "express";
import { ValidationProblemDetails } from "../types/validation";

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
        // MySQL duplicate entry errors
        if (error?.code === 'ER_DUP_ENTRY' || error?.errno === 1062) {
            return true;
        }
        
        // Generic unique constraint violation detection (database-agnostic)
        const errorMessage = this.getErrorMessage(error);
        if (errorMessage.includes('UNIQUE constraint') || 
            errorMessage.includes('duplicate key') ||
            errorMessage.includes('unique constraint')) {
            return true;
        }
        
        return false;
    }

    private static extractDuplicateField(errorMessage: string): string | null {
        // MySQL format: "Duplicate entry 'VND-001' for key 'vendas.codigo'"
        let match = errorMessage.match(/Duplicate entry '([^']+)'/i);
        if (match && match[1]) {
            return match[1];
        }
        
        // SQLite format: "UNIQUE constraint failed: vendas.codigo"
        // Extract from the error message or try to get it from the request context
        // For SQLite, we'll need to extract from a different pattern or use a generic message
        match = errorMessage.match(/UNIQUE constraint failed: \w+\.(\w+)/i);
        if (match) {
            // For SQLite, we can't extract the value directly, but we know it's a duplicate
            // We'll return null and use a generic message
            return null;
        }

        return null;
    }

    static handleError(res: Response, error: any, defaultMessage: string, defaultStatus: number = 500): Response {
        const errorMessage = this.getErrorMessage(error);

        // Handle duplicate entry errors (422 Unprocessable Entity - OWASP)
        if (this.isDuplicateError(error)) {
            // Try to get duplicate value from error object (attached by service)
            let duplicateValue = error?.duplicateValue;
            
            // If not available, try to extract from error message
            if (!duplicateValue) {
                duplicateValue = this.extractDuplicateField(errorMessage);
            }
            
            // For SQLite errors, try to extract the field name to provide better context
            let message = "Duplicate entry: This record already exists";
            if (duplicateValue) {
                message = `A sale with code '${duplicateValue}' already exists`;
            } else if (errorMessage.includes('codigo')) {
                // SQLite error mentions the field name
                message = "A sale with this code already exists";
            }
            
            return res.status(422).json({
                type: "https://api.example.com/problems/duplicate-entry",
                title: "Unprocessable Entity",
                status: 422,
                detail: message,
                error: message // Backward compatibility
            });
        }

        if (this.isFinishedStatusError(errorMessage)) {
            return res.status(422).json({
                type: "https://api.example.com/problems/business-rule-violation",
                title: "Unprocessable Entity",
                status: 422,
                detail: errorMessage,
                error: errorMessage // Backward compatibility
            });
        }

        if (this.isProductError(errorMessage)) {
            return res.status(400).json({
                type: "https://api.example.com/problems/bad-request",
                title: "Bad Request",
                status: 400,
                detail: errorMessage,
                error: errorMessage // Backward compatibility
            });
        }

        if (this.isNotFoundError(errorMessage)) {
            return res.status(404).json({
                type: "https://api.example.com/problems/not-found",
                title: "Not Found",
                status: 404,
                detail: errorMessage,
                error: errorMessage // Backward compatibility
            });
        }

        return res.status(defaultStatus).json({
            type: "https://api.example.com/problems/internal-server-error",
            title: "Internal Server Error",
            status: defaultStatus,
            detail: defaultMessage,
            error: defaultMessage, // Backward compatibility
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

    /**
     * Returns validation errors in RFC 7807 Problem Details format
     * Following OWASP best practices for structured error responses
     * Also includes backward-compatible 'error' property for existing tests
     */
    static validationError(
        res: Response, 
        statusCode: number, 
        fieldErrors: Array<{ field: string; message: string }>
    ): Response {
        const detail = fieldErrors.length === 1 
            ? fieldErrors[0].message 
            : "One or more fields failed validation.";
        
        const problemDetails: ValidationProblemDetails & { error?: string } = {
            type: "https://api.example.com/problems/validation-error",
            title: statusCode === 400 ? "Bad Request" : "Unprocessable Entity",
            status: statusCode,
            detail,
            errors: fieldErrors,
            // Backward compatibility: include 'error' property for existing tests
            error: fieldErrors.length === 1 
                ? `${fieldErrors[0].field}: ${fieldErrors[0].message}`
                : `Validation failed: ${fieldErrors.map(e => `${e.field}: ${e.message}`).join('; ')}`
        };

        return res.status(statusCode).json(problemDetails);
    }
}

