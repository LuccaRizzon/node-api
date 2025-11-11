import { AppDataSource } from "../data-source";
import "reflect-metadata";

process.env.NODE_ENV = "test";

beforeAll(async () => {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
  } catch (error) {
    console.error("Erro ao inicializar DataSource nos testes:", error);
  }
});

afterAll(async () => {
  try {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  } catch (error) {
    console.error("Erro ao fechar DataSource nos testes:", error);
  }
});

