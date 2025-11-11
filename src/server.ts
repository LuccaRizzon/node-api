import 'dotenv/config';
import "reflect-metadata";
import { app } from "./app";
import { DisconnectServer } from "./config/db";

const server = app.listen(3001, () => console.log('Server running on port 3001'));

const gracefulShutdown = async (signal: string) => {
    console.log(`${signal} received. Shutting down gracefully...`);
    
    server.close(async () => {
        console.log('HTTP server closed');
        
        try {
            await DisconnectServer();
            console.log('Shutdown complete');
            process.exit(0);
        } catch (error) {
            console.error('Error during shutdown:', error);
            process.exit(1);
        }
    });
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
