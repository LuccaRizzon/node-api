/**
 * Validation error types following OWASP best practices
 * - syntactic: 400 Bad Request (missing fields, wrong types, format errors)
 * - semantic: 422 Unprocessable Entity (valid syntax but violates business rules)
 */
export type ValidationErrorType = 'syntactic' | 'semantic';

/**
 * Validation error message format
 * Can be a simple string (fallback) or an object with explicit type
 */
export type ValidationErrorMessage = 
    | string 
    | { msg: string; type: ValidationErrorType };

/**
 * RFC 7807 Problem Details format for validation errors
 */
export interface ValidationProblemDetails {
    type: string;
    title: string;
    status: number;
    detail: string;
    errors: Array<{
        field: string;
        message: string;
    }>;
}

