import 'dotenv/config';
import { AppDataSource } from "../data-source";
import { Produto } from "../entity/Produto";
import "reflect-metadata";
import { roundMoney } from "../utils/money";

const requiredEnv = [
    { keys: ["DB_HOST"], label: "DB_HOST" },
    { keys: ["DB_PORT"], label: "DB_PORT" },
    { keys: ["DB_USERNAME", "DB_USER"], label: "DB_USERNAME/DB_USER" },
    { keys: ["DB_PASSWORD", "DB_PASS"], label: "DB_PASSWORD/DB_PASS" },
    { keys: ["DB_DATABASE", "DB_NAME"], label: "DB_DATABASE/DB_NAME" }
];

async function seed() {
    try {
        const missingVars = requiredEnv.filter((entry) => !entry.keys.some((key) => process.env[key]));

        if (missingVars.length > 0) {
            console.error('Error: Missing required environment variables:');
            missingVars.forEach(varInfo => console.error(`  - ${varInfo.label}`));
            console.error('\nPlease create a .env file based on env.example');
            process.exit(1);
        }

        console.log("Initializing database connection...");
        await AppDataSource.initialize();

        const produtoRepository = AppDataSource.getRepository(Produto);

        const existingProducts = await produtoRepository.count();
        if (existingProducts > 0) {
            console.log(`Database already has ${existingProducts} products. Skipping seed.`);
            await AppDataSource.destroy();
            return;
        }

        console.log("Creating initial products...");

        const produtos = [
            { nome: "Notebook Dell Inspiron", preco: roundMoney(3500.00) },
            { nome: "Mouse Logitech MX Master", preco: roundMoney(450.00) },
            { nome: "Teclado Mecânico RGB", preco: roundMoney(650.00) },
            { nome: "Monitor LG 27 polegadas", preco: roundMoney(1200.00) },
            { nome: "Webcam Logitech C920", preco: roundMoney(550.00) },
            { nome: "Headset HyperX Cloud", preco: roundMoney(750.00) },
            { nome: "SSD Samsung 1TB", preco: roundMoney(800.00) },
            { nome: "Memória RAM 16GB DDR4", preco: roundMoney(600.00) },
            { nome: "Placa de Vídeo RTX 3060", preco: roundMoney(2500.00) },
            { nome: "Gabinete Gamer RGB", preco: roundMoney(400.00) }
        ];

        const produtosCriados = produtoRepository.create(produtos);
        await produtoRepository.save(produtosCriados);

        console.log(`Successfully created ${produtos.length} products!`);
        console.log("\nProducts created:");
        produtos.forEach((produto, index) => {
            console.log(`  ${index + 1}. ${produto.nome} - R$ ${parseFloat(produto.preco).toFixed(2)}`);
        });

        await AppDataSource.destroy();
        console.log("\nSeed completed successfully!");
    } catch (error) {
        console.error("Error running seed:", error);
        if (AppDataSource.isInitialized) {
            await AppDataSource.destroy();
        }
        process.exit(1);
    }
}

seed();

