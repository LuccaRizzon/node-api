import 'dotenv/config';
import { DataSource } from "typeorm";
import { Produto } from "./entity/Produto";
import { Venda } from "./entity/Venda";
import { VendaItem } from "./entity/VendaItem";

const resolveEnv = (vars: string[], fallback?: string): string | undefined => {
    for (const variable of vars) {
        const value = process.env[variable];
        if (value) {
            return value;
        }
    }
    return fallback;
};

const DB_USERNAME = resolveEnv(["DB_USERNAME", "DB_USER"]);
const DB_PASSWORD = resolveEnv(["DB_PASSWORD", "DB_PASS"]);
const DB_DATABASE = resolveEnv(["DB_DATABASE", "DB_NAME"]);
const DB_HOST = resolveEnv(["DB_HOST"], "localhost");
const DB_PORT = resolveEnv(["DB_PORT"], "3306");

export const AppDataSource = new DataSource({
    type: "mysql",
    host: DB_HOST,
    port: parseInt(DB_PORT || "3306", 10),
    username: DB_USERNAME,
    password: DB_PASSWORD,
    database: DB_DATABASE,
    entities: [Produto, Venda, VendaItem],
    synchronize: false,
    migrations: ["src/migration/**/*.ts"],
    migrationsTableName: "migrations",
    logging: process.env.NODE_ENV === 'development',
    extra: {
        connectionLimit: parseInt(process.env.DB_POOL_SIZE || '10', 10),
    },
    poolSize: parseInt(process.env.DB_POOL_SIZE || '10', 10),
});
