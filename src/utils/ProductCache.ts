import { Produto } from "../entity/Produto";
import { getDataSource } from "./getDataSource";

interface CacheEntry {
    product: Produto;
    timestamp: number;
}

export class ProductCache {
    private static cache: Map<number, CacheEntry> = new Map();
    private static readonly TTL_MS = parseInt(process.env.PRODUCT_CACHE_TTL_MS || '300000', 10); // Default: 5 minutes (300000ms)


    static async get(id: number, queryRunner?: any): Promise<Produto | null> {
        const entry = this.cache.get(id);
        const now = Date.now();

        if (entry && (now - entry.timestamp) < this.TTL_MS) {
            return entry.product;
        }

        const manager = queryRunner?.manager || getDataSource().manager;
        const product = await manager.findOne(Produto, { where: { id } });

        if (product) {
            this.cache.set(id, {
                product,
                timestamp: now
            });
        } else {
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
}

