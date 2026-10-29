/**
 * Shared domain enums and invariants used across models and (later) services.
 *
 * Order statuses and transitions mirror `docs/api-contract.md` §7 and the
 * approved business rules in `StockFlow_Project_Brief.md` §7.
 */

export const USER_ROLES = ['admin', 'employee'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const REFRESH_SESSION_STATUSES = ['active', 'rotated', 'revoked'] as const;
export type RefreshSessionStatus = (typeof REFRESH_SESSION_STATUSES)[number];

export const ORDER_STATUSES = ['pending', 'confirmed', 'shipped', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const MOVEMENT_TYPES = [
  'manual_adjustment',
  'order_reserve',
  'order_confirm',
  'order_release',
  'order_restore',
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

/**
 * Approved transition table. `shipped` and `cancelled` are final.
 */
export const ALLOWED_ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped: [],
  cancelled: [],
};
