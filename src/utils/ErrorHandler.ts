import { Response } from "express";
import { ValidationProblemDetails } from "../types/validation";
import { AppError, ProblemDetails, conflictError } from "./AppError";

export class ErrorHandler {
    private static isDuplicateError(error: any): boolean {
        // MySQL duplicate entry errors
        if (error?.code === 'ER_DUP_ENTRY' || error?.errno === 1062) {
            return true;
        }
        
        // Generic unique constraint violation detection (database-agnostic)
        const errorMessage = this.extractErrorMessage(error);
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

        match = errorMessage.match(/UNIQUE constraint failed: \w+\.(\w+)/i);
        if (match) {
            return null;
        }

        return null;
    }

    private static extractErrorMessage(error: any): string {
        if (error instanceof Error) {
            return error.message;
        }
        if (error?.message) {
            return error.message;
        }
        return String(error);
    }

    private static toProblemResponse(res: Response, problem: ProblemDetails): Response {
        return res.status(problem.status).json({
            type: problem.type,
            title: problem.title,
            status: problem.status,
            detail: problem.detail,
            code: problem.code,
            errors: problem.errors ?? []
        });
    }

    private static handleDuplicate(res: Response, error: any): Response {
        const message = this.extractErrorMessage(error);
        const duplicateValue = error?.duplicateValue ?? this.extractDuplicateField(message);

        const detail = duplicateValue
            ? `A sale with code '${duplicateValue}' already exists.`
            : "A sale with this code already exists.";

        return this.toProblemResponse(
            res,
            conflictError(detail, "SALE_CODE_EXISTS", {
                errors: [
                    {
                        field: "codigo",
                        message: detail
                    }
                ]
            }).problem
        );
    }

    static handleError(res: Response, error: any, defaultMessage: string, defaultStatus: number = 500): Response {
        if (error instanceof AppError) {
            return this.toProblemResponse(res, error.problem);
        }

        if (this.isDuplicateError(error)) {
            return this.handleDuplicate(res, error);
        }

        this.logInternalError(error);

        return this.toProblemResponse(
            res,
            {
                type: "https://api.example.com/problems/internal-server-error",
                title: "Internal Server Error",
                status: defaultStatus,
                detail: defaultMessage
            }
        );
    }

    static badRequest(res: Response, message: string, customError?: string): Response {
        return this.toProblemResponse(res, {
            type: "https://api.example.com/problems/bad-request",
            title: "Bad Request",
            status: 400,
            detail: customError || message
        });
    }

    static notFound(res: Response, message: string = "Resource not found"): Response {
        return this.toProblemResponse(res, {
            type: "https://api.example.com/problems/not-found",
            title: "Not Found",
            status: 404,
            detail: message
        });
    }

    static internalServerError(res: Response, message: string = "Internal server error"): Response {
        return this.toProblemResponse(res, {
            type: "https://api.example.com/problems/internal-server-error",
            title: "Internal Server Error",
            status: 500,
            detail: message
        });
    }

    static unprocessableEntity(res: Response, message: string): Response {
        return this.toProblemResponse(res, {
            type: "https://api.example.com/problems/business-rule-violation",
            title: "Unprocessable Entity",
            status: 422,
            detail: message
        });
    }

    /**
     * Returns validation errors in RFC 7807 Problem Details format
     * Following OWASP best practices for structured error responses
     */
    static validationError(
        res: Response, 
        statusCode: number, 
        fieldErrors: Array<{ field: string; message: string }>
    ): Response {
        const detail = fieldErrors.length === 1 
            ? fieldErrors[0].message 
            : "One or more fields failed validation.";
        
        const problemDetails: ValidationProblemDetails = {
            type: "https://api.example.com/problems/validation-error",
            title: statusCode === 400 ? "Bad Request" : "Unprocessable Entity",
            status: statusCode,
            detail,
            errors: fieldErrors
        };

        return res.status(statusCode).json(problemDetails);
    }

    private static logInternalError(error: any): void {
        console.error("[ErrorHandler] Internal error", error);
    }
}
