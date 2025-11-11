import { DataSource } from "typeorm";
import { Produto } from "../entity/Produto";
import { Venda } from "../entity/Venda";
import { VendaItem } from "../entity/VendaItem";

export const TestDataSource = new DataSource({
    type: "better-sqlite3",
    database: ":memory:",
    entities: [Produto, Venda, VendaItem],
    synchronize: true,
    logging: false,
    dropSchema: false,
});

