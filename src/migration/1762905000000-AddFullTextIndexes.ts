import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFullTextIndexes1762905000000 implements MigrationInterface {
    name = 'AddFullTextIndexes1762905000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable("vendas");
        const hasIndex = table?.indices.some(index => index.name === "IDX_VENDAS_FULLTEXT_SEARCH");

        if (!hasIndex) {
            await queryRunner.query(`
                ALTER TABLE \`vendas\`
                ADD FULLTEXT INDEX \`IDX_VENDAS_FULLTEXT_SEARCH\` (\`codigo\`, \`nomeCliente\`)
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable("vendas");
        const hasIndex = table?.indices.some(index => index.name === "IDX_VENDAS_FULLTEXT_SEARCH");

        if (hasIndex) {
            await queryRunner.query(`
                ALTER TABLE \`vendas\`
                DROP INDEX \`IDX_VENDAS_FULLTEXT_SEARCH\`
            `);
        }
    }
}


