/**
 * Registers all Mongoose models with a single import so that both `ts-node`/`tsx`
 * development and production builds always load every schema
 * (registration happens as a side effect of importing this module).
 */

import './user.model';
import './refreshSession.model';
import './category.model';
import './product.model';
import './order.model';
import './stockMovement.model';
import './counter.model';

export { User } from './user.model';
export { RefreshSession } from './refreshSession.model';
export { Category } from './category.model';
export { Product } from './product.model';
export { Order } from './order.model';
export { StockMovement } from './stockMovement.model';
export { Counter, nextOrderNumber } from './counter.model';
export * from './types';
