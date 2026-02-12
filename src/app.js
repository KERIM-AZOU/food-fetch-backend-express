import express from 'express';
import cors from 'cors';
import corsOptions from './config/cors.js';
import apiRoutes from './routes/index.js';
import errorHandler from './middleware/errorHandler.js';

const app = express();

// ── Global middleware ────────────────────────────────────────────────
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

// ── Health check ─────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', service: 'food-finder-v2' });
});

// ── API routes ───────────────────────────────────────────────────────
app.use('/api', apiRoutes);

// ── Global error handler (must be last) ──────────────────────────────
app.use(errorHandler);

export default app;
