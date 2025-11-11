import { Request, Response, NextFunction } from "express";
import { validationResult, ValidationChain } from "express-validator";
import { ErrorHandler } from "../utils/ErrorHandler";

export const validate = (validations: ValidationChain[]) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        await Promise.all(validations.map(validation => validation.run(req)));

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const errorMessages = errors.array().map(err => {
                if (err.type === 'field') {
                    return `${err.path}: ${err.msg}`;
                }
                return err.msg;
            });
            
            return ErrorHandler.badRequest(
                res, 
                `Validation failed: ${errorMessages.join('; ')}`
            );
        }

        next();
    };
};

