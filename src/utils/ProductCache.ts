import { QueryRunner } from "typeorm";
import { Produto } from "../entity/Produto";
import { getRedisClient, type RedisClient } from "../config/redis";
import { getDataSource } from "./getDataSource";

interface CacheEntry {
    product: Produto;
    timestamp: number;
    accessTime: number;
}

export class ProductCache {
    private static readonly TTL_MS = parseInt(process.env.PRODUCT_CACHE_TTL_MS || "300000", 10);
    private static readonly TTL_SECONDS = Math.max(1, Math.floor(ProductCache.TTL_MS / 1000));
    private static readonly MAX_SIZE = parseInt(process.env.PRODUCT_CACHE_MAX_SIZE || "1000", 10);
    private static readonly KEY_PREFIX = process.env.PRODUCT_CACHE_KEY_PREFIX || "product-cache:produto:";
    private static readonly LRU_KEY = process.env.PRODUCT_CACHE_LRU_KEY || "product-cache:lru";

    private static fallbackCache: Map<number, CacheEntry> = new Map();
    private static fallbackEnabled: boolean = process.env.REDIS_DISABLED === "true";

    private static getCacheKey(id: number): string {
        return `${this.KEY_PREFIX}${id}`;
    }

    private static hydrateProduto(data: any): Produto {
        return Object.assign(new Produto(), data);
    }

    private static async tryGetRedisClient() {
        if (this.fallbackEnabled) {
            return null;
        }

        const client = await getRedisClient();
        if (!client) {
            this.fallbackEnabled = true;
        }
        return client;
    }

    private static cleanFallbackExpired(): void {
        const now = Date.now();
        for (const [id, entry] of Array.from(this.fallbackCache.entries())) {
            if ((now - entry.timestamp) >= this.TTL_MS) {
                this.fallbackCache.delete(id);
            }
        }
    }

    private static evictFallbackLRU(): void {
        if (this.fallbackCache.size < this.MAX_SIZE) {
            return;
        }

        const entries = Array.from(this.fallbackCache.entries())
            .sort((a, b) => a[1].accessTime - b[1].accessTime);

        const toRemove = Math.max(1, Math.floor(entries.length * 0.1));
        for (let i = 0; i < toRemove; i++) {
            this.fallbackCache.delete(entries[i][0]);
        }
    }

    private static async fetchProductFromDatabase(id: number, queryRunner?: QueryRunner): Promise<Produto | null> {
        const manager = queryRunner?.manager || getDataSource().manager;
        return manager.findOne(Produto, { where: { id } });
    }

    private static async cacheInRedis(id: number, product: Produto, lruScore: number): Promise<boolean> {
        const client = await this.tryGetRedisClient();
        if (!client) {
            return false;
        }

        const key = this.getCacheKey(id);
        try {
            await client.set(key, JSON.stringify(product), { PX: this.TTL_MS });
            await client.zAdd(this.LRU_KEY, [{ score: lruScore, value: key }]);
            await this.enforceRedisSizeLimit(client);
            return true;
        } catch (error) {
            console.error("[ProductCache] Failed to cache product in Redis. Switching to fallback cache.", error);
            this.fallbackEnabled = true;
            return false;
        }
    }

    private static async enforceRedisSizeLimit(client: RedisClient): Promise<void> {
        const currentSize = await client.zCard(this.LRU_KEY);
        if (currentSize <= this.MAX_SIZE) {
            return;
        }

        const excess = currentSize - this.MAX_SIZE;
        const keysToRemove = await client.zRange(this.LRU_KEY, 0, excess - 1);
        if (keysToRemove.length === 0) {
            return;
        }

        await Promise.all(keysToRemove.map(key => client.del(key)));
        await Promise.all(keysToRemove.map(key => client.zRem(this.LRU_KEY, key)));
    }

    private static cacheInFallback(id: number, product: Produto, timestamp: number): void {
        if (this.fallbackCache.size >= this.MAX_SIZE) {
            this.evictFallbackLRU();
        }

        this.fallbackCache.set(id, {
            product,
            timestamp,
            accessTime: timestamp,
        });
    }

    private static async getFromRedis(id: number): Promise<Produto | null> {
        const client = await this.tryGetRedisClient();
        if (!client) {
            return null;
        }

        const key = this.getCacheKey(id);
        try {
            const cached = await client.get(key);
            if (!cached) {
                return null;
            }

            await client.expire(key, this.TTL_SECONDS);
            await client.zAdd(this.LRU_KEY, [{ score: Date.now(), value: key }]);

            return this.hydrateProduto(JSON.parse(cached));
        } catch (error) {
            console.error("[ProductCache] Failed to read product from Redis. Falling back to in-memory cache.", error);
            this.fallbackEnabled = true;
            return null;
        }
    }

    private static getFromFallback(id: number): Produto | null {
        if (Math.random() < 0.1) {
            this.cleanFallbackExpired();
        }

        const entry = this.fallbackCache.get(id);
        if (!entry) {
            return null;
        }

        if ((Date.now() - entry.timestamp) >= this.TTL_MS) {
            this.fallbackCache.delete(id);
            return null;
        }

        entry.accessTime = Date.now();
        return entry.product;
    }

    static async get(id: number, queryRunner?: QueryRunner): Promise<Produto | null> {
        const fromRedis = await this.getFromRedis(id);
        if (fromRedis) {
            return fromRedis;
        }

        const fallbackEntry = this.getFromFallback(id);
        if (fallbackEntry) {
            return fallbackEntry;
        }

        const product = await this.fetchProductFromDatabase(id, queryRunner);
        if (!product) {
            await this.invalidate(id);
            return null;
        }

        const now = Date.now();
        const cachedInRedis = await this.cacheInRedis(id, product, now);
        if (!cachedInRedis || this.fallbackEnabled) {
            this.cacheInFallback(id, product, now);
        }

        return product;
    }

    static async invalidate(id: number): Promise<void> {
        const client = await this.tryGetRedisClient();
        const key = this.getCacheKey(id);

        if (client) {
            try {
                await client.del(key);
                await client.zRem(this.LRU_KEY, key);
            } catch (error) {
                console.error("[ProductCache] Failed to invalidate Redis entry. Continuing with fallback removal.", error);
            }
        }

        this.fallbackCache.delete(id);
    }

    static async clear(): Promise<void> {
        const client = await this.tryGetRedisClient();

        if (client) {
            try {
                const keys = await client.zRange(this.LRU_KEY, 0, -1);
                if (keys.length > 0) {
                    await Promise.all(keys.map(key => client.del(key)));
                }
                await client.del(this.LRU_KEY);
            } catch (error) {
                console.error("[ProductCache] Failed to clear Redis cache. Clearing fallback cache only.", error);
            }
        }

        this.fallbackCache.clear();
    }

    static async getStats(): Promise<{ size: number; maxSize: number; ttl: number }> {
        const client = await this.tryGetRedisClient();
        if (client) {
            try {
                const size = await client.zCard(this.LRU_KEY);
                return { size, maxSize: this.MAX_SIZE, ttl: this.TTL_MS };
            } catch (error) {
                console.error("[ProductCache] Failed to read Redis stats. Returning fallback stats.", error);
            }
        }

        this.cleanFallbackExpired();
        return {
            size: this.fallbackCache.size,
            maxSize: this.MAX_SIZE,
            ttl: this.TTL_MS,
        };
    }
}
