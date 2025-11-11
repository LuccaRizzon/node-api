import { TestDataSource } from "./test-data-source";
import "reflect-metadata";

process.env.NODE_ENV = "test";
process.env.REDIS_DISABLED = "true";

beforeAll(async () => {
  try {
    if (!TestDataSource.isInitialized) {
      await TestDataSource.initialize();
      console.log("TestDataSource initialized successfully");
    }
  } catch (error) {
    console.error("Error initializing TestDataSource:", error);
    throw error;
  }
}, 30000);

afterAll(async () => {
  try {
    if (TestDataSource.isInitialized) {
      await TestDataSource.destroy();
      console.log("TestDataSource destroyed successfully");
    }
  } catch (error) {
    console.error("Error closing TestDataSource:", error);
  }
});

