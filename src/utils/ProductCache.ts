import { Produto } from "../entity/Produto";
import { AppDataSource } from "../data-source";

interface CacheEntry {
    product: Produto;
    timestamp: number;
}

export class ProductCache {
    private static cache: Map<number, CacheEntry> = new Map();
    private static readonly TTL_MS = parseInt(process.env.PRODUCT_CACHE_TTL_MS || '300000', 10); // Default: 5 minutes (300000ms)

    /**
     * Get a product from cache or database
     * @param id Product ID
     * @param queryRunner Optional query runner for transaction context
     * @returns Product or null if not found
     */
    static async get(id: number, queryRunner?: any): Promise<Produto | null> {
        const entry = this.cache.get(id);
        const now = Date.now();

        // Check if cached entry exists and is still valid
        if (entry && (now - entry.timestamp) < this.TTL_MS) {
            return entry.product;
        }

        // Fetch from database
        const manager = queryRunner?.manager || AppDataSource.manager;
        const product = await manager.findOne(Produto, { where: { id } });

        if (product) {
            // Cache the product
            this.cache.set(id, {
                product,
                timestamp: now
            });
        } else {
            // Remove from cache if not found
            this.cache.delete(id);
        }

        return product;
    }

    /**
     * Invalidate a specific product from cache
     * @param id Product ID
     */
    static invalidate(id: number): void {
        this.cache.delete(id);
    }

    /**
     * Clear all cached products
     */
    static clear(): void {
        this.cache.clear();
    }

    /**
     * Get cache statistics (useful for monitoring)
     */
    static getStats(): { size: number; entries: number[] } {
        return {
            size: this.cache.size,
            entries: Array.from(this.cache.keys())
        };
    }
}

