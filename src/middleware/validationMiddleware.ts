import { Request, Response, NextFunction } from "express";
import { validationResult, ValidationChain, ValidationError } from "express-validator";
import { ErrorHandler } from "../utils/ErrorHandler";
import { ValidationErrorType, ValidationErrorMessage } from "../types/validation";

/**
 * Parses validation error message - supports JSON-encoded objects or plain strings
 */
const parseValidationMessage = (errorMsg: string): ValidationErrorMessage => {
    // Try to parse as JSON (for typed messages)
    try {
        const parsed = JSON.parse(errorMsg);
        if (typeof parsed === 'object' && parsed.msg && parsed.type) {
            return parsed as ValidationErrorMessage;
        }
    } catch {
        // Not JSON, treat as plain string
    }
    
    // Fallback to plain string
    return errorMsg;
};

/**
 * Extracts error type from validation error message
 * Supports explicit tagging via object format or falls back to pattern matching
 */
const extractErrorType = (errorMsg: string): ValidationErrorType => {
    const parsed = parseValidationMessage(errorMsg);
    
    // If error message is an object with explicit type, use it directly
    if (typeof parsed === 'object' && parsed.type) {
        return parsed.type;
    }
    
    // Fallback to pattern matching for string messages (backward compatibility)
    const msg = typeof parsed === 'string' ? parsed : parsed.msg;
    return isSemanticValidationError(msg) ? 'semantic' : 'syntactic';
};

/**
 * Extracts error message text from validation error
 */
const extractErrorMessage = (errorMsg: string): string => {
    const parsed = parseValidationMessage(errorMsg);
    return typeof parsed === 'object' ? parsed.msg : parsed;
};

/**
 * Determines if a validation error is semantic (422) or syntactic (400)
 * Used as fallback when error messages don't have explicit type tags
 * Based on OWASP best practices with improved regex pattern matching
 */
const isSemanticValidationError = (errorMsg: string): boolean => {
    const lowerMsg = errorMsg.toLowerCase();
    
    // IMPORTANT: Check for range validation FIRST (semantic - 422)
    // Range validation means the type is correct but the value is out of range
    if (/(integer|decimal|number|value|parameter)\s+between/i.test(errorMsg) ||
        /must\s+be\s+between/i.test(errorMsg) ||
        /\d+\s+and\s+(2147483647|100|\d+)/.test(errorMsg)) {
        return true; // Semantic error (422)
    }
    
    // Syntactic errors (400) - wrong type, format, or missing required fields
    // Using regex for more flexible matching
    const syntacticPatterns = [
        /\bis\s+required\b/i, // Missing required field
        /must\s+be\s+(a\s+)?string\b/i, // Type mismatch (but NOT in range context)
        /must\s+be\s+(a\s+)?integer\b/i, // Type mismatch (but NOT "must be an integer between")
        /must\s+be\s+(a\s+)?float\b/i, // Type mismatch
        /must\s+be\s+(a\s+)?valid\s+iso\s*8601/i, // Format error
        /must\s+be\s+(a\s+)?valid\s+decimal\s+number/i, // Format error
    ];
    
    // Check if it's a pure type/format/required field error (syntactic - 400)
    // Exclude range validation which we already handled above
    if (syntacticPatterns.some(pattern => {
        if (pattern.test(errorMsg) && !/between/i.test(errorMsg)) {
            return true; // Matches syntactic pattern and not a range error
        }
        return false;
    })) {
        return false; // Syntactic error (400)
    }
    
    // Semantic errors (422) - valid syntax but violates business rules
    // Using regex for more flexible matching
    const semanticPatterns = [
        /(contains|has|includes)\s+(invalid|disallowed|forbidden)\s+characters?/i, // Character whitelist violation
        /can\s+have\s+at\s+most/i, // Decimal precision, length limits
        /must\s+be\s+one\s+of/i, // Enum/status validation
        /exceeds?/i, // Overflow, max values
        /must\s+be\s+(an?\s+)?array/i, // Array type validation
        /at\s+least\s+one/i, // Array minimum length
    ];
    
    // Check semantic patterns - if found, it's a semantic error (422)
    if (semanticPatterns.some(pattern => pattern.test(errorMsg))) {
        return true;
    }
    
    // Default to semantic (422) for any other validation error
    // This follows OWASP guidance: if syntax is correct but validation fails, use 422
    return true;
};

export const validate = (validations: ValidationChain[]) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        await Promise.all(validations.map(validation => validation.run(req)));

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            // Process errors: extract types and messages
            const processedErrors = errors.array().map((err: ValidationError) => {
                const errorType = extractErrorType(err.msg);
                const errorMessage = extractErrorMessage(err.msg);
                const field = err.type === 'field' ? err.path : undefined;
                
                return {
                    field,
                    message: errorMessage,
                    type: errorType
                };
            });
            
            // Determine overall error type: prioritize syntactic errors (400) over semantic errors (422)
            // If ANY error is syntactic (missing field, wrong type, format), return 400
            // Only if ALL errors are semantic, return 422
            const hasSyntacticError = processedErrors.some(err => err.type === 'syntactic');
            const statusCode = hasSyntacticError ? 400 : 422;
            
            // Format errors for RFC 7807 Problem Details
            const fieldErrors = processedErrors
                .filter(err => err.field)
                .map(err => ({
                    field: err.field!,
                    message: err.message
                }));
            
            return ErrorHandler.validationError(res, statusCode, fieldErrors);
        }

        next();
    };
};
