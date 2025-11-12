export interface ProblemDetails {
    type: string;
    title: string;
    status: number;
    detail: string;
    code?: string;
    errors?: Array<{ field?: string; message: string }>;
}

export class AppError extends Error {
    public readonly problem: ProblemDetails;

    constructor(problem: ProblemDetails) {
        super(problem.detail);
        this.problem = problem;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

const buildProblem = (
    status: number,
    detail: string,
    options: Partial<ProblemDetails> = {}
): ProblemDetails => {
    return {
        type: options.type ?? "https://api.example.com/problems/internal-error",
        title: options.title ?? "Error",
        status,
        detail,
        code: options.code,
        errors: options.errors
    };
};

export const conflictError = (
    detail: string,
    code: string,
    options: Partial<ProblemDetails> = {}
): AppError => {
    return new AppError(
        buildProblem(409, detail, {
            type: "https://api.example.com/problems/conflict",
            title: "Conflict",
            code,
            ...options
        })
    );
};

export const businessRuleError = (
    detail: string,
    code: string,
    options: Partial<ProblemDetails> = {}
): AppError => {
    return new AppError(
        buildProblem(422, detail, {
            type: "https://api.example.com/problems/business-rule-violation",
            title: "Unprocessable Entity",
            code,
            ...options
        })
    );
};

export const notFoundError = (
    detail: string,
    code: string,
    options: Partial<ProblemDetails> = {}
): AppError => {
    return new AppError(
        buildProblem(404, detail, {
            type: "https://api.example.com/problems/not-found",
            title: "Not Found",
            code,
            ...options
        })
    );
};

export const badRequestError = (
    detail: string,
    code: string,
    options: Partial<ProblemDetails> = {}
): AppError => {
    return new AppError(
        buildProblem(400, detail, {
            type: "https://api.example.com/problems/bad-request",
            title: "Bad Request",
            code,
            ...options
        })
    );
};

export const internalServerError = (
    detail: string = "An unexpected error occurred."
): AppError => {
    return new AppError(
        buildProblem(500, detail, {
            type: "https://api.example.com/problems/internal-server-error",
            title: "Internal Server Error"
        })
    );
};


