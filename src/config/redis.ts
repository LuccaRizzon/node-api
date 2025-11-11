import { createClient } from 'redis';

export type RedisClient = ReturnType<typeof createClient>;

let client: RedisClient | null = null;
let connectPromise: Promise<RedisClient | null> | null = null;
let redisDisabled = process.env.REDIS_DISABLED === 'true';
let loggedConnectionError = false;

const buildRedisUrl = (): string => {
    if (process.env.REDIS_URL) {
        return process.env.REDIS_URL;
    }

    const host = process.env.REDIS_HOST || '127.0.0.1';
    const port = process.env.REDIS_PORT || '6379';
    const username = process.env.REDIS_USERNAME;
    const password = process.env.REDIS_PASSWORD;

    if (username && password) {
        return `redis://${username}:${password}@${host}:${port}`;
    }

    if (password && !username) {
        return `redis://:${password}@${host}:${port}`;
    }

    return `redis://${host}:${port}`;
};

const createRedisClient = (): RedisClient => {
    const redisClient = createClient({
        url: buildRedisUrl(),
        socket: {
            reconnectStrategy: (retries) => Math.min(retries * 50, 1000),
        },
    });

    redisClient.on('error', (err) => {
        if (!loggedConnectionError) {
            console.error('[Redis] Connection error detected. Falling back to in-memory cache.', err);
            loggedConnectionError = true;
        }
        redisDisabled = true;
    });

    redisClient.on('connect', () => {
        loggedConnectionError = false;
        redisDisabled = false;
        console.log('[Redis] Connected successfully');
    });

    return redisClient;
};

export const getRedisClient = async (): Promise<RedisClient | null> => {
    if (redisDisabled) {
        return null;
    }

    if (client?.isOpen) {
        return client;
    }

    if (!client) {
        client = createRedisClient();
    }

    if (!connectPromise) {
        connectPromise = client.connect()
            .then(() => client)
            .catch((error) => {
                if (!loggedConnectionError) {
                    console.error('[Redis] Failed to establish connection. Using in-memory cache.', error);
                    loggedConnectionError = true;
                }
                redisDisabled = true;
                return null;
            })
            .finally(() => {
                connectPromise = null;
            });
    }

    return connectPromise;
};

export const disconnectRedis = async (): Promise<void> => {
    try {
        if (client?.isOpen) {
            await client.quit();
            console.log('[Redis] Disconnected successfully');
        }
    } catch (error) {
        console.error('[Redis] Error while disconnecting:', error);
    } finally {
        client = null;
    }
};


