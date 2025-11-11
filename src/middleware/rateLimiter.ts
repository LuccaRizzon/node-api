import rateLimit from 'express-rate-limit';

/**
 * Rate limiting middleware to prevent abuse and ensure fair resource usage
 * Limits: 100 requests per 15 minutes per IP address
 */
export const apiRateLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // Default: 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10), // Default: 100 requests per window
    message: {
        type: "https://api.example.com/problems/rate-limit-exceeded",
        title: "Too Many Requests",
        status: 429,
        detail: "Too many requests from this IP, please try again later.",
        error: "Too many requests from this IP, please try again later." // Backward compatibility
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

