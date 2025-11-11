import { body, param, query, ValidationChain } from "express-validator";
import { StatusVenda } from "../entity/Venda";

// MySQL INT (signed) maximum value: 2,147,483,647
// JavaScript Number.MAX_SAFE_INTEGER: 9,007,199,254,740,991
// We use MySQL INT max to prevent database overflow
const MAX_INT = 2147483647; // MySQL INT maximum
const MIN_INT = 1; // Minimum positive integer

// Helper to validate decimal numbers (max 10 digits, 2 decimal places)
const decimalValidator = (field: string, min: number = 0) => {
    return body(field)
        .optional()
        .isFloat({ min, max: 99999999.99 })
        .withMessage(`${field} must be a valid decimal number between ${min} and 99999999.99`)
        .custom((value) => {
            if (value !== undefined && value !== null) {
                const decimalPlaces = (value.toString().split('.')[1] || '').length;
                if (decimalPlaces > 2) {
                    throw new Error(`${field} can have at most 2 decimal places`);
                }
            }
            return true;
        });
};

// Helper to validate string with length limit
const stringValidator = (field: string, maxLength: number, required: boolean = true) => {
    const chain = required 
        ? body(field).notEmpty().withMessage(`${field} is required`)
        : body(field).optional();
    
    return chain
        .isString()
        .withMessage(`${field} must be a string`)
        .trim()
        .isLength({ min: 1, max: maxLength })
        .withMessage(`${field} must be between 1 and ${maxLength} characters`)
        .matches(/^[a-zA-Z0-9\s\-_.,áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]*$/)
        .withMessage(`${field} contains invalid characters. Only letters, numbers, spaces, and basic punctuation are allowed`);
};

// Helper to validate status enum
const statusValidator = (field: string, required: boolean = false) => {
    const chain = required
        ? body(field).notEmpty().withMessage(`${field} is required`)
        : body(field).optional();
    
    return chain
        .isString()
        .withMessage(`${field} must be a string`)
        .isIn([StatusVenda.ABERTA, StatusVenda.CONCLUIDA, StatusVenda.CANCELADA])
        .withMessage(`${field} must be one of: ${StatusVenda.ABERTA}, ${StatusVenda.CONCLUIDA}, ${StatusVenda.CANCELADA}`);
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
        .notEmpty()
        .withMessage('itens is required')
        .isArray({ min: 1 })
        .withMessage('itens must be an array with at least one item'),
    
    body('itens.*.produtoId')
        .isInt({ min: MIN_INT, max: MAX_INT })
        .withMessage(`Each item must have a valid produtoId (integer between ${MIN_INT} and ${MAX_INT})`),
    
    body('itens.*.quantidade')
        .isInt({ min: MIN_INT, max: MAX_INT })
        .withMessage(`Each item must have a valid quantidade (integer between ${MIN_INT} and ${MAX_INT})`),
    
    body('itens.*.precoUnitario')
        .isFloat({ min: 0, max: 99999999.99 })
        .withMessage('Each item must have a valid precoUnitario (decimal between 0 and 99999999.99)')
        .custom((value) => {
            if (value !== undefined && value !== null) {
                const decimalPlaces = (value.toString().split('.')[1] || '').length;
                if (decimalPlaces > 2) {
                    throw new Error('precoUnitario can have at most 2 decimal places');
                }
            }
            return true;
        }),
    
    body('itens.*.descontoItem')
        .optional()
        .isFloat({ min: 0, max: 99999999.99 })
        .withMessage('Each item descontoItem must be a valid decimal between 0 and 99999999.99')
        .custom((value) => {
            if (value !== undefined && value !== null) {
                const decimalPlaces = (value.toString().split('.')[1] || '').length;
                if (decimalPlaces > 2) {
                    throw new Error('descontoItem can have at most 2 decimal places');
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
        .isArray({ min: 1 })
        .withMessage('itens must be an array with at least one item when provided'),
    
    body('itens.*.produtoId')
        .if(body('itens').exists())
        .isInt({ min: MIN_INT, max: MAX_INT })
        .withMessage(`Each item must have a valid produtoId (integer between ${MIN_INT} and ${MAX_INT})`),
    
    body('itens.*.quantidade')
        .if(body('itens').exists())
        .isInt({ min: MIN_INT, max: MAX_INT })
        .withMessage(`Each item must have a valid quantidade (integer between ${MIN_INT} and ${MAX_INT})`),
    
    body('itens.*.precoUnitario')
        .if(body('itens').exists())
        .isFloat({ min: 0, max: 99999999.99 })
        .withMessage('Each item must have a valid precoUnitario (decimal between 0 and 99999999.99)')
        .custom((value) => {
            if (value !== undefined && value !== null) {
                const decimalPlaces = (value.toString().split('.')[1] || '').length;
                if (decimalPlaces > 2) {
                    throw new Error('precoUnitario can have at most 2 decimal places');
                }
            }
            return true;
        }),
    
    body('itens.*.descontoItem')
        .if(body('itens').exists())
        .optional()
        .isFloat({ min: 0, max: 99999999.99 })
        .withMessage('Each item descontoItem must be a valid decimal between 0 and 99999999.99')
        .custom((value) => {
            if (value !== undefined && value !== null) {
                const decimalPlaces = (value.toString().split('.')[1] || '').length;
                if (decimalPlaces > 2) {
                    throw new Error('descontoItem can have at most 2 decimal places');
                }
            }
            return true;
        }),
];

// Validation for ID parameter
export const validateId = [
    param('id')
        .isInt({ min: MIN_INT, max: MAX_INT })
        .withMessage(`ID must be an integer between ${MIN_INT} and ${MAX_INT}`)
];

// Validation for query parameters (list endpoint)
export const validateListQuery = [
    query('dataInicio')
        .optional()
        .isISO8601()
        .withMessage('dataInicio must be a valid ISO 8601 date (YYYY-MM-DD)'),
    
    query('dataFim')
        .optional()
        .isISO8601()
        .withMessage('dataFim must be a valid ISO 8601 date (YYYY-MM-DD)'),
    
    query('page')
        .optional()
        .isInt({ min: MIN_INT, max: MAX_INT })
        .withMessage(`page must be an integer between ${MIN_INT} and ${MAX_INT}`),
    
    query('limit')
        .optional()
        .isInt({ min: MIN_INT, max: 100 })
        .withMessage('limit must be an integer between 1 and 100'),
    
    query('search')
        .optional()
        .isString()
        .withMessage('search must be a string')
        .trim()
        .isLength({ min: 1, max: 255 })
        .withMessage('search must be between 1 and 255 characters')
        .matches(/^[a-zA-Z0-9\s\-_.,áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]*$/)
        .withMessage('search contains invalid characters. Only letters, numbers, spaces, and basic punctuation are allowed'),
];

