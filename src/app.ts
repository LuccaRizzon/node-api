import express from 'express';
import cors from 'cors';
import logger from 'morgan';

import { ConnectServer } from './config/db';
import { routerVenda } from './routes/venda';

export const app = express();

app.use(cors());
app.use(express.json());
app.use(logger('dev'));

if (process.env.NODE_ENV !== 'test') {
    ConnectServer();
}

app.use('/vendas', routerVenda);

app.use('/', (req, res) => {
    res.status(200).send('Default path');
});
