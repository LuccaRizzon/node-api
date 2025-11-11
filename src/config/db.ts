import { AppDataSource } from "../data-source";

export const ConnectServer = async () => {
    try {
        await AppDataSource.initialize();
        console.log(`App connected to DB ${AppDataSource.options.database}`);
    } catch (error) {
        console.error("Error connecting to DB:", error);
        throw error;
    }
};

export const DisconnectServer = async () => {
    try {
        if (AppDataSource.isInitialized) {
            await AppDataSource.destroy();
            console.log('Connection to DB closed');
        }
    } catch (error) {
        console.error('Error closing connection to DB:', error);
        throw error;
    }
};
