import { AppDataSource } from "../data-source";
import "reflect-metadata";

export const ConnectServer = async () => {
    try {
        await AppDataSource.initialize();
        console.log(`App connected to DB ${AppDataSource.options.database}`);

        const handleExit = async () => {
            try {
                if (AppDataSource.isInitialized) {
                    await AppDataSource.destroy();
                    console.log('Connection to DB closed');
                }
            } catch (error) {
                console.error('Error closing connection to DB:', error);
            } finally {
                process.exit(0);
            }
        };

        process.on('SIGINT', handleExit);
        process.on('SIGTERM', handleExit);
    } catch (error) {
        console.error("Error connecting to DB:", error);
    }
};
