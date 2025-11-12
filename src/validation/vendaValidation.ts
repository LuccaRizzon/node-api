import { body, param, query, ValidationChain } from "express-validator";
import { StatusVenda } from "../entity/Venda";
import { ValidationErrorMessage } from "../types/validation";

// MySQL INT (signed) maximum value: 2,147,483,647
// JavaScript Number.MAX_SAFE_INTEGER: 9,007,199,254,740,991
// We use MySQL INT max to prevent database overflow
const MAX_INT = 2147483647; // MySQL INT maximum
const MIN_INT = 1; // Minimum positive integer

/**
 * Helper to create typed validation error messages
 * Serializes as JSON string for express-validator compatibility
 */
const createValidationMessage = (msg: string, type: 'syntactic' | 'semantic'): string => {
    const errorObj: ValidationErrorMessage = { msg, type };
    return JSON.stringify(errorObj);
};

// Helper to validate decimal numbers (max 10 digits, 2 decimal places)
const decimalValidator = (field: string, min: number = 0) => {
    return body(field)
        .optional()
        .isFloat({ min, max: 99999999.99 })
        .withMessage(createValidationMessage(
            `${field} must be a valid decimal number between ${min} and 99999999.99`,
            'semantic'
        ))
        .custom((value) => {
            if (value !== undefined && value !== null) {
                const decimalPlaces = (value.toString().split('.')[1] || '').length;
                if (decimalPlaces > 2) {
                    throw new Error(createValidationMessage(
                        `${field} can have at most 2 decimal places`,
                        'semantic'
                    ));
                }
            }
            return true;
        });
};

// Helper to validate string with length limit
const stringValidator = (field: string, maxLength: number, required: boolean = true) => {
    const chain = required 
        ? body(field).notEmpty().withMessage(createValidationMessage(
            `${field} is required`,
            'syntactic'
        ))
        : body(field).optional();
    
    return chain
        .isString()
        .withMessage(createValidationMessage(
            `${field} must be a string`,
            'syntactic'
        ))
        .trim()
        .isLength({ min: 1, max: maxLength })
        .withMessage(createValidationMessage(
            `${field} must be between 1 and ${maxLength} characters`,
            'semantic'
        ))
        .matches(/^[a-zA-Z0-9\s\-_.,áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]*$/)
        .withMessage(createValidationMessage(
            `${field} contains invalid characters. Only letters, numbers, spaces, and basic punctuation are allowed`,
            'semantic'
        ));
};

// Helper to validate status enum
const statusValidator = (field: string, required: boolean = false) => {
    const chain = required
        ? body(field).notEmpty().withMessage(createValidationMessage(
            `${field} is required`,
            'syntactic'
        ))
        : body(field).optional();
    
    return chain
        .isString()
        .withMessage(createValidationMessage(
            `${field} must be a string`,
            'syntactic'
        ))
        .isIn([StatusVenda.ABERTA, StatusVenda.CONCLUIDA, StatusVenda.CANCELADA])
        .withMessage(createValidationMessage(
            `${field} must be one of: ${StatusVenda.ABERTA}, ${StatusVenda.CONCLUIDA}, ${StatusVenda.CANCELADA}`,
            'semantic'
        ));
};

// Validation for creating a sale
export const validateCreateVenda = [
    // codigo: varchar(50)
    stringValidator('codigo', 50, true),
    
    // nomeCliente: varchar(100)
    stringValidator('nomeCliente', 100, true),
    
    // descontoVenda: decimal(10,2)
    decimalValidator('descontoVenda', 0),
    
    // status: enum
    statusValidator('status', false),
    
    // itens: array
    body('itens')
        .custom((value) => {
            // Check if value is undefined (missing - syntactic error 400)
            if (value === undefined) {
                throw new Error(createValidationMessage('itens is required', 'syntactic'));
            }
            // Check if value is an array (semantic error if not, including null)
            // null and other non-array values are semantic errors (422)
            if (!Array.isArray(value)) {
                throw new Error(createValidationMessage('itens must be an array', 'semantic'));
            }
            return true;
        })
        .isArray({ min: 1 })
        .withMessage(createValidationMessage(
            'itens must be an array with at least one item',
            'semantic'
        )),
    
    body('itens.*.produtoId')
        .custom((value) => {
            if (typeof value !== 'number' || !Number.isInteger(value)) {
                throw new Error(createValidationMessage('produtoId must be an integer', 'syntactic'));
            }
            return true;
        })
        .isInt({ min: MIN_INT, max: MAX_INT })
        .withMessage(createValidationMessage(
            `Each item must have a valid produtoId (integer between ${MIN_INT} and ${MAX_INT})`,
            'semantic'
        )),
    
    body('itens.*.quantidade')
        .custom((value) => {
            if (typeof value !== 'number' || !Number.isInteger(value)) {
                throw new Error(createValidationMessage('quantidade must be an integer', 'syntactic'));
            }
            return true;
        })
        .isInt({ min: MIN_INT, max: MAX_INT })
        .withMessage(createValidationMessage(
            `Each item must have a valid quantidade (integer between ${MIN_INT} and ${MAX_INT})`,
            'semantic'
        )),
    
    body('itens.*.precoUnitario')
        .custom((value) => {
            if (typeof value !== 'number' || isNaN(value)) {
                throw new Error(createValidationMessage('precoUnitario must be a float', 'syntactic'));
            }
            return true;
        })
        .isFloat({ min: 0.01, max: 99999999.99 })
        .withMessage(createValidationMessage(
            'Each item must have a valid precoUnitario (decimal greater than 0 and up to 99999999.99)',
            'semantic'
        ))
        .custom((value) => {
            if (value !== undefined && value !== null) {
                const decimalPlaces = (value.toString().split('.')[1] || '').length;
                if (decimalPlaces > 2) {
                    throw new Error(createValidationMessage(
                        'precoUnitario can have at most 2 decimal places',
                        'semantic'
                    ));
                }
            }
            return true;
        }),
    
    body('itens.*.descontoItem')
        .optional()
        .isFloat({ min: 0, max: 99999999.99 })
        .withMessage(createValidationMessage(
            'Each item descontoItem must be a valid decimal between 0 and 99999999.99',
            'semantic'
        ))
        .custom((value) => {
            if (value !== undefined && value !== null) {
                const decimalPlaces = (value.toString().split('.')[1] || '').length;
                if (decimalPlaces > 2) {
                    throw new Error(createValidationMessage(
                        'descontoItem can have at most 2 decimal places',
                        'semantic'
                    ));
                }
            }
            return true;
        }),
];

// Validation for updating a sale
export const validateUpdateVenda = [
    // codigo: varchar(50) - optional
    stringValidator('codigo', 50, false),
    
    // nomeCliente: varchar(100) - optional
    stringValidator('nomeCliente', 100, false),
    
    // descontoVenda: decimal(10,2) - optional
    decimalValidator('descontoVenda', 0),
    
    // status: enum - optional
    statusValidator('status', false),
    
    // itens: array - optional
    body('itens')
        .optional()
        .custom((value) => {
            if (value !== undefined && value !== null && !Array.isArray(value)) {
                throw new Error(createValidationMessage('itens must be an array', 'semantic'));
            }
            return true;
        })
        .isArray({ min: 1 })
        .withMessage(createValidationMessage(
            'itens must be an array with at least one item when provided',
            'semantic'
        )),
    
    body('itens.*.produtoId')
        .if(body('itens').exists())
        .custom((value) => {
            if (typeof value !== 'number' || !Number.isInteger(value)) {
                throw new Error(createValidationMessage('produtoId must be an integer', 'syntactic'));
            }
            return true;
        })
        .isInt({ min: MIN_INT, max: MAX_INT })
        .withMessage(createValidationMessage(
            `Each item must have a valid produtoId (integer between ${MIN_INT} and ${MAX_INT})`,
            'semantic'
        )),
    
    body('itens.*.quantidade')
        .if(body('itens').exists())
        .custom((value) => {
            if (typeof value !== 'number' || !Number.isInteger(value)) {
                throw new Error(createValidationMessage('quantidade must be an integer', 'syntactic'));
            }
            return true;
        })
        .isInt({ min: MIN_INT, max: MAX_INT })
        .withMessage(createValidationMessage(
            `Each item must have a valid quantidade (integer between ${MIN_INT} and ${MAX_INT})`,
            'semantic'
        )),
    
    body('itens.*.precoUnitario')
        .if(body('itens').exists())
        .custom((value) => {
            if (typeof value !== 'number' || isNaN(value)) {
                throw new Error(createValidationMessage('precoUnitario must be a float', 'syntactic'));
            }
            return true;
        })
        .isFloat({ min: 0.01, max: 99999999.99 })
        .withMessage(createValidationMessage(
            'Each item must have a valid precoUnitario (decimal greater than 0 and up to 99999999.99)',
            'semantic'
        ))
        .custom((value) => {
            if (value !== undefined && value !== null) {
                const decimalPlaces = (value.toString().split('.')[1] || '').length;
                if (decimalPlaces > 2) {
                    throw new Error(createValidationMessage(
                        'precoUnitario can have at most 2 decimal places',
                        'semantic'
                    ));
                }
            }
            return true;
        }),
    
    body('itens.*.descontoItem')
        .if(body('itens').exists())
        .optional()
        .isFloat({ min: 0, max: 99999999.99 })
        .withMessage(createValidationMessage(
            'Each item descontoItem must be a valid decimal between 0 and 99999999.99',
            'semantic'
        ))
        .custom((value) => {
            if (value !== undefined && value !== null) {
                const decimalPlaces = (value.toString().split('.')[1] || '').length;
                if (decimalPlaces > 2) {
                    throw new Error(createValidationMessage(
                        'descontoItem can have at most 2 decimal places',
                        'semantic'
                    ));
                }
            }
            return true;
        }),
];

// Validation for ID parameter
export const validateId = [
    param('id')
        .custom((value) => {
            // Check if it's a valid integer string or number (type check - 400)
            // URL parameters are always strings, so check for float strings
            if (typeof value === 'string' && value.includes('.')) {
                throw new Error(createValidationMessage('ID must be an integer', 'syntactic'));
            }
            const num = typeof value === 'string' ? parseInt(value, 10) : value;
            if (isNaN(num) || !Number.isInteger(num)) {
                throw new Error(createValidationMessage('ID must be an integer', 'syntactic'));
            }
            // Check range (range check - 422)
            if (num < MIN_INT || num > MAX_INT) {
                throw new Error(createValidationMessage(
                    `ID must be an integer between ${MIN_INT} and ${MAX_INT}`,
                    'semantic'
                ));
            }
            return true;
        })
];

// Validation for query parameters (list endpoint)
export const validateListQuery = [
    query('dataInicio')
        .optional()
        .isISO8601()
        .withMessage(createValidationMessage(
            'dataInicio must be a valid ISO 8601 date (YYYY-MM-DD)',
            'syntactic'
        )),
    
    query('dataFim')
        .optional()
        .isISO8601()
        .withMessage(createValidationMessage(
            'dataFim must be a valid ISO 8601 date (YYYY-MM-DD)',
            'syntactic'
        )),
    
    query('page')
        .optional()
        .custom((value) => {
            if (value === undefined || value === null) {
                return true; // Optional field
            }
            // Check if it's a valid integer string or number (type check - 400)
            // Query parameters are always strings, so check for float strings
            if (typeof value === 'string' && value.includes('.')) {
                throw new Error(createValidationMessage('page must be an integer', 'syntactic'));
            }
            const num = typeof value === 'string' ? parseInt(value, 10) : value;
            if (isNaN(num) || !Number.isInteger(num)) {
                throw new Error(createValidationMessage('page must be an integer', 'syntactic'));
            }
            // Check range (range check - 422)
            if (num < MIN_INT || num > MAX_INT) {
                throw new Error(createValidationMessage(
                    `page must be an integer between ${MIN_INT} and ${MAX_INT}`,
                    'semantic'
                ));
            }
            return true;
        }),
    
    query('limit')
        .optional()
        .custom((value) => {
            if (value === undefined || value === null) {
                return true; // Optional field
            }
            // Check if it's a valid integer string or number (type check - 400)
            // Query parameters are always strings, so check for float strings
            if (typeof value === 'string' && value.includes('.')) {
                throw new Error(createValidationMessage('limit must be an integer', 'syntactic'));
            }
            const num = typeof value === 'string' ? parseInt(value, 10) : value;
            if (isNaN(num) || !Number.isInteger(num)) {
                throw new Error(createValidationMessage('limit must be an integer', 'syntactic'));
            }
            // Check range (range check - 422)
            if (num < MIN_INT || num > 100) {
                throw new Error(createValidationMessage(
                    'limit must be an integer between 1 and 100',
                    'semantic'
                ));
            }
            return true;
        }),
    
    query('search')
        .optional()
        .isString()
        .withMessage(createValidationMessage('search must be a string', 'syntactic'))
        .trim()
        .isLength({ min: 1, max: 255 })
        .withMessage(createValidationMessage(
            'search must be between 1 and 255 characters',
            'semantic'
        ))
        .matches(/^[a-zA-Z0-9\s\-_.,áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]*$/)
        .withMessage(createValidationMessage(
            'search contains invalid characters. Only letters, numbers, spaces, and basic punctuation are allowed',
            'semantic'
        )),
];

