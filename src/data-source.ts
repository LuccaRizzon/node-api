import 'dotenv/config';
import { DataSource } from "typeorm";
import { Produto } from "./entity/Produto";
import { Venda } from "./entity/Venda";
import { VendaItem } from "./entity/VendaItem";

export const AppDataSource = new DataSource({
    type: "mysql",
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "3306", 10),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    entities: [Produto, Venda, VendaItem],
    synchronize: false,
    migrations: ["src/migration/**/*.ts"],
    migrationsTableName: "migrations",
    logging: true,
});
