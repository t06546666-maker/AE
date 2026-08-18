import express from 'express';
import cors from 'cors';
import { sharonRouter } from './router';

export const app = express();

app.use(cors());
app.use(express.json());

// Mount Sharon Engine REST API
app.use('/api', sharonRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'Sharon Rewards Settlement Engine', timestamp: new Date().toISOString() });
});
