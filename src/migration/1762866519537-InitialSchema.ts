import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from "typeorm";

export class InitialSchema1762866519537 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        const produtosTable = await queryRunner.getTable("produtos");
        if (!produtosTable) {
            await queryRunner.createTable(
                new Table({
                    name: "produtos",
                    columns: [
                        {
                            name: "id",
                            type: "int",
                            isPrimary: true,
                            isGenerated: true,
                            generationStrategy: "increment"
                        },
                        {
                            name: "nome",
                            type: "varchar",
                            length: "100",
                            isNullable: false
                        },
                        {
                            name: "preco",
                            type: "decimal",
                            precision: 10,
                            scale: 2,
                            isNullable: false
                        }
                    ]
                }),
                true
            );
        }

        const vendasTable = await queryRunner.getTable("vendas");
        if (!vendasTable) {
            await queryRunner.createTable(
                new Table({
                    name: "vendas",
                    columns: [
                        {
                            name: "id",
                            type: "int",
                            isPrimary: true,
                            isGenerated: true,
                            generationStrategy: "increment"
                        },
                        {
                            name: "codigo",
                            type: "varchar",
                            length: "50",
                            isNullable: false,
                            isUnique: true
                        },
                        {
                            name: "dataHora",
                            type: "datetime",
                            default: "CURRENT_TIMESTAMP"
                        },
                        {
                            name: "nomeCliente",
                            type: "varchar",
                            length: "100",
                            isNullable: false
                        },
                        {
                            name: "descontoVenda",
                            type: "decimal",
                            precision: 10,
                            scale: 2,
                            isNullable: false,
                            default: 0
                        },
                        {
                            name: "valorTotal",
                            type: "decimal",
                            precision: 10,
                            scale: 2,
                            isNullable: false,
                            default: 0
                        },
                        {
                            name: "status",
                            type: "enum",
                            enum: ["Aberta", "Concluída", "Cancelada"],
                            default: "'Aberta'"
                        }
                    ]
                }),
                true
            );
        }

        const vendasTableForIndex = await queryRunner.getTable("vendas");
        if (vendasTableForIndex) {
            const codigoIndex = vendasTableForIndex.indices.find(index => index.name === "IDX_VENDAS_CODIGO");
            if (!codigoIndex) {
                await queryRunner.createIndex(
                    "vendas",
                    new TableIndex({
                        name: "IDX_VENDAS_CODIGO",
                        columnNames: ["codigo"]
                    })
                );
            }
        }

        const vendaItensTable = await queryRunner.getTable("venda_itens");
        if (!vendaItensTable) {
            await queryRunner.createTable(
                new Table({
                    name: "venda_itens",
                    columns: [
                        {
                            name: "id",
                            type: "int",
                            isPrimary: true,
                            isGenerated: true,
                            generationStrategy: "increment"
                        },
                        {
                            name: "venda_id",
                            type: "int",
                            isNullable: false
                        },
                        {
                            name: "produto_id",
                            type: "int",
                            isNullable: false
                        },
                        {
                            name: "quantidade",
                            type: "int",
                            isNullable: false
                        },
                        {
                            name: "precoUnitario",
                            type: "decimal",
                            precision: 10,
                            scale: 2,
                            isNullable: false
                        },
                        {
                            name: "descontoItem",
                            type: "decimal",
                            precision: 10,
                            scale: 2,
                            isNullable: false,
                            default: 0
                        },
                        {
                            name: "valorTotal",
                            type: "decimal",
                            precision: 10,
                            scale: 2,
                            isNullable: false,
                            default: 0
                        }
                    ]
                }),
                true
            );
        }

        const vendaItensTableForFK = await queryRunner.getTable("venda_itens");
        if (vendaItensTableForFK) {
            const vendaFK = vendaItensTableForFK.foreignKeys.find(fk => fk.columnNames.indexOf("venda_id") !== -1);
            if (!vendaFK) {
                await queryRunner.createForeignKey(
                    "venda_itens",
                    new TableForeignKey({
                        columnNames: ["venda_id"],
                        referencedColumnNames: ["id"],
                        referencedTableName: "vendas",
                        onDelete: "CASCADE"
                    })
                );
            }

            const produtoFK = vendaItensTableForFK.foreignKeys.find(fk => fk.columnNames.indexOf("produto_id") !== -1);
            if (!produtoFK) {
                await queryRunner.createForeignKey(
                    "venda_itens",
                    new TableForeignKey({
                        columnNames: ["produto_id"],
                        referencedColumnNames: ["id"],
                        referencedTableName: "produtos",
                        onDelete: "RESTRICT"
                    })
                );
            }

            const vendaIdIndex = vendaItensTableForFK.indices.find(index => index.name === "IDX_VENDA_ITENS_VENDA_ID");
            if (!vendaIdIndex) {
                await queryRunner.createIndex(
                    "venda_itens",
                    new TableIndex({
                        name: "IDX_VENDA_ITENS_VENDA_ID",
                        columnNames: ["venda_id"]
                    })
                );
            }

            const produtoIdIndex = vendaItensTableForFK.indices.find(index => index.name === "IDX_VENDA_ITENS_PRODUTO_ID");
            if (!produtoIdIndex) {
                await queryRunner.createIndex(
                    "venda_itens",
                    new TableIndex({
                        name: "IDX_VENDA_ITENS_PRODUTO_ID",
                        columnNames: ["produto_id"]
                    })
                );
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable("venda_itens");
        await queryRunner.dropTable("vendas");
        await queryRunner.dropTable("produtos");
    }

}
