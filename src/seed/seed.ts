import 'dotenv/config';
import { AppDataSource } from "../data-source";
import { Produto } from "../entity/Produto";
import "reflect-metadata";

async function seed() {
    try {
        // Valida variáveis de ambiente
        const requiredEnvVars = ['DB_HOST', 'DB_PORT', 'DB_USERNAME', 'DB_PASSWORD', 'DB_DATABASE'];
        const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
        
        if (missingVars.length > 0) {
            console.error('Error: Missing required environment variables:');
            missingVars.forEach(varName => console.error(`  - ${varName}`));
            console.error('\nPlease create a .env file based on .env.example');
            process.exit(1);
        }

        console.log("Initializing database connection...");
        await AppDataSource.initialize();

        const produtoRepository = AppDataSource.getRepository(Produto);

        // Verifica se já existem produtos
        const existingProducts = await produtoRepository.count();
        if (existingProducts > 0) {
            console.log(`Database already has ${existingProducts} products. Skipping seed.`);
            await AppDataSource.destroy();
            return;
        }

        console.log("Creating initial products...");

        const produtos = [
            { nome: "Notebook Dell Inspiron", preco: 3500.00 },
            { nome: "Mouse Logitech MX Master", preco: 450.00 },
            { nome: "Teclado Mecânico RGB", preco: 650.00 },
            { nome: "Monitor LG 27 polegadas", preco: 1200.00 },
            { nome: "Webcam Logitech C920", preco: 550.00 },
            { nome: "Headset HyperX Cloud", preco: 750.00 },
            { nome: "SSD Samsung 1TB", preco: 800.00 },
            { nome: "Memória RAM 16GB DDR4", preco: 600.00 },
            { nome: "Placa de Vídeo RTX 3060", preco: 2500.00 },
            { nome: "Gabinete Gamer RGB", preco: 400.00 }
        ];

        const produtosCriados = produtoRepository.create(produtos);
        await produtoRepository.save(produtosCriados);

        console.log(`Successfully created ${produtos.length} products!`);
        console.log("\nProducts created:");
        produtos.forEach((produto, index) => {
            console.log(`  ${index + 1}. ${produto.nome} - R$ ${produto.preco.toFixed(2)}`);
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

