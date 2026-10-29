/**
 * Mount point for all `/api` routes.
 *
 * Add each upcoming feature area (auth, products, categories, orders,
 * dashboard, uploads) as its own router mounted here.
 */

import { Router } from 'express';
import healthRouter from './health';

const router = Router();
router.use(healthRouter);

export default router;
