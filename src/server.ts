import 'dotenv/config';
import "reflect-metadata";
import { app } from "./app";
import { DisconnectServer } from "./config/db";
import { disconnectRedis } from "./config/redis";

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

const server = app.listen(port, () => console.log(`Server running on port ${port}`));

const gracefulShutdown = async (signal: string) => {
    console.log(`${signal} received. Shutting down gracefully...`);
    
    server.close(async () => {
        console.log('HTTP server closed');
        
        try {
            await DisconnectServer();
            await disconnectRedis();
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
