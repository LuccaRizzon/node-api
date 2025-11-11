import { MigrationInterface, QueryRunner, TableIndex } from "typeorm";

export class AddPerformanceIndexes1762898197869 implements MigrationInterface {
    name = 'AddPerformanceIndexes1762898197869'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Index on dataHora for ORDER BY and date filtering (most common query pattern)
        const dataHoraIndex = await queryRunner.getTable("vendas");
        if (dataHoraIndex) {
            const existingIndex = dataHoraIndex.indices.find(index => index.name === "IDX_VENDAS_DATAHORA");
            if (!existingIndex) {
                await queryRunner.createIndex(
                    "vendas",
                    new TableIndex({
                        name: "IDX_VENDAS_DATAHORA",
                        columnNames: ["dataHora"]
                    })
                );
            }
        }

        // Composite index on status and dataHora for filtered queries with sorting
        const statusDataHoraIndex = await queryRunner.getTable("vendas");
        if (statusDataHoraIndex) {
            const existingIndex = statusDataHoraIndex.indices.find(index => index.name === "IDX_VENDAS_STATUS_DATAHORA");
            if (!existingIndex) {
                await queryRunner.createIndex(
                    "vendas",
                    new TableIndex({
                        name: "IDX_VENDAS_STATUS_DATAHORA",
                        columnNames: ["status", "dataHora"]
                    })
                );
            }
        }

        // Index on nomeCliente for search queries (partial index would be better but MySQL doesn't support it well)
        const nomeClienteIndex = await queryRunner.getTable("vendas");
        if (nomeClienteIndex) {
            const existingIndex = nomeClienteIndex.indices.find(index => index.name === "IDX_VENDAS_NOMECLIENTE");
            if (!existingIndex) {
                await queryRunner.createIndex(
                    "vendas",
                    new TableIndex({
                        name: "IDX_VENDAS_NOMECLIENTE",
                        columnNames: ["nomeCliente"]
                    })
                );
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove indexes in reverse order
        const vendasTable = await queryRunner.getTable("vendas");
        if (vendasTable) {
            const nomeClienteIndex = vendasTable.indices.find(index => index.name === "IDX_VENDAS_NOMECLIENTE");
            if (nomeClienteIndex) {
                await queryRunner.dropIndex("vendas", "IDX_VENDAS_NOMECLIENTE");
            }

            const statusDataHoraIndex = vendasTable.indices.find(index => index.name === "IDX_VENDAS_STATUS_DATAHORA");
            if (statusDataHoraIndex) {
                await queryRunner.dropIndex("vendas", "IDX_VENDAS_STATUS_DATAHORA");
            }

            const dataHoraIndex = vendasTable.indices.find(index => index.name === "IDX_VENDAS_DATAHORA");
            if (dataHoraIndex) {
                await queryRunner.dropIndex("vendas", "IDX_VENDAS_DATAHORA");
            }
        }
    }
}
