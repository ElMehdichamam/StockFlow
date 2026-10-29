/**
 * `GET /api/health` — liveness endpoint.
 *
 * Reports process uptime and the live MongoDB connection state. Useful for
 * health checks from deploy platforms; the `database` field reflects the
 * Mongoose connection state without blocking the response.
 */

import { Router } from 'express';
import { getDatabaseState } from '../config/db';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({
    data: {
      status: 'ok',
      database: getDatabaseState(),
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    },
  });
});

export default router;
