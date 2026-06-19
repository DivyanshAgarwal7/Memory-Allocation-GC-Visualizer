import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './auth/auth.routes.js';
import { generalLimiter } from './middleware/rateLimit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = path.join(__dirname, '..', '..', 'frontend');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1); // needed for correct IPs behind a reverse proxy / load balancer

// ── Security headers ────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// ── CORS ─────────────────────────────────────────────────────────
// Restricted to a single configured origin; credentials enabled for cookies.
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN || 'http://localhost:4000',
    credentials: true,
    methods: ['GET', 'POST'],
  })
);

// ── Body parsing & cookies ─────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

// ── Rate limiting for all API routes ────────────────────────────
app.use('/api', generalLimiter);

// ── Routes ───────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);

// Unknown API routes -> JSON 404 (don't fall through to static handler)
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// ── Static frontend ──────────────────────────────────────────────
app.use(express.static(FRONTEND_DIR, { extensions: ['html'], index: false }));

app.get('/', (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'landing.html'));
});

// Fallback for unknown frontend routes
app.use((req, res) => {
  res.status(404).sendFile(path.join(FRONTEND_DIR, 'landing.html'));
});

// ── Central error handler ───────────────────────────────────────
// Never leak stack traces or internal details to the client.
app.use((err, req, res, _next) => {
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path} ->`, err);
  if (res.headersSent) return;
  res.status(err.status || 500).json({ error: 'Something went wrong. Please try again.' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`memsim-server listening on http://localhost:${PORT}`);
});
