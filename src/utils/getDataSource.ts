import { DataSource } from "typeorm";
import { AppDataSource } from "../data-source";

let TestDataSource: DataSource | null = null;

export function getTestDataSource(): DataSource {
    if (!TestDataSource) {
        const testModule = require("../__tests__/test-data-source");
        TestDataSource = testModule.TestDataSource;
    }
    
    if (!TestDataSource.isInitialized) {
        throw new Error(
            "TestDataSource is not initialized. " +
            "This usually means setup.ts didn't run properly. " +
            "Make sure jest.config.js has setupFilesAfterEnv configured correctly."
        );
    }
    
    return TestDataSource;
}

export function getDataSource(): DataSource {
    if (process.env.NODE_ENV === "test") {
        return getTestDataSource();
    }

    return AppDataSource;
}

