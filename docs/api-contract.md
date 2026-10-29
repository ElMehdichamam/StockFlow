# StockFlow API Contract

**Status:** Draft v1.2 — all previously open decisions resolved using owner-approved defaults (see §12 and Change Log §13); awaiting final owner approval before implementation
**Base path:** `/api`
**Data format:** JSON
**Currency:** USD; monetary amounts are represented as integer cents
**Authentication:** JWT access tokens and rotating refresh tokens

This document defines the proposed HTTP API shared by the StockFlow frontend and backend. Neither side may independently change endpoint paths, request/response formats, permissions, or business behavior.

## 1. General conventions

### 1.1 Base URL

Local development example:

`http://localhost:5000/api`

The actual port and production URL depend on the project setup.

### 1.2 Identifiers and timestamps

- MongoDB ObjectIds are serialized as strings.
- Timestamps use ISO 8601 UTC strings, such as `2026-10-28T12:30:00.000Z`.
- Resource identifiers are called `id` in JSON responses, even if the database uses `_id`.
- Order numbers use a human-readable format such as `ORD-000123`. The order number is distinct from the MongoDB ID.

### 1.3 Successful responses

Single-resource responses use:

```json
{
  "data": {
    "id": "671234567890abcdef123456"
  }
}
```

Collection responses use:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 10,
    "totalItems": 0,
    "totalPages": 0
  }
}
```

For non-paginated collections, `meta` may be omitted. The response shape must be consistent for each endpoint.

### 1.4 Error responses

All API errors use this structure:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid fields.",
    "details": {
      "email": "Enter a valid email address."
    }
  }
}
```

`details` is optional. It may contain field-specific validation errors or other structured information safe to expose.

Expected HTTP statuses:

| Status | Meaning |
|---|---|
| `200` | Successful read or update |
| `201` | Resource created |
| `204` | Successful operation with no response body |
| `400` | Invalid request or malformed input |
| `401` | Missing, expired, or invalid authentication |
| `403` | Authenticated user lacks permission or account is disabled |
| `404` | Resource not found |
| `409` | Business-rule conflict, duplicate value, or insufficient stock |
| `413` | Upload too large |
| `415` | Unsupported media type |
| `429` | Rate limit exceeded |
| `500` | Unexpected server error |

Error codes should be stable and documented. Examples include `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `DUPLICATE_SKU`, `INSUFFICIENT_STOCK`, `INVALID_ORDER_TRANSITION`, and `CONFLICT`.

Never return stack traces, secrets, password hashes, refresh tokens, or internal database details in API errors.

## 2. Authentication

### Permissions

Public endpoints:
- Registration
- Login
- Refresh
- Logout

All other endpoints require an authenticated user unless explicitly stated otherwise.

### `POST /auth/register`

Create an employee account. Public registration must never accept a role that grants admin permissions.

Request:

```json
{
  "name": "Sara Ahmed",
  "email": "sara@example.com",
  "password": "example-password"
}
```

Response: `201 Created`

```json
{
  "data": {
    "user": {
      "id": "671234567890abcdef123456",
      "name": "Sara Ahmed",
      "email": "sara@example.com",
      "role": "employee",
      "isActive": true
    }
  }
}
```

The response must not include the password or password hash.

### `POST /auth/login`

Request:

```json
{
  "email": "sara@example.com",
  "password": "example-password"
}
```

Response: `200 OK`

```json
{
  "data": {
    "user": {
      "id": "671234567890abcdef123456",
      "name": "Sara Ahmed",
      "email": "sara@example.com",
      "role": "employee",
      "isActive": true
    },
    "accessToken": "<access-jwt>",
    "expiresIn": 900
  }
}
```

The server also sets the refresh token in an HttpOnly cookie. The refresh token must not be returned in the JSON response.

Access tokens expire after 15 minutes.

### `POST /auth/refresh`

Uses the refresh-token cookie. No refresh token is accepted from the JSON body.

Response: `200 OK`

```json
{
  "data": {
    "accessToken": "<new-access-jwt>",
    "expiresIn": 900
  }
}
```

The server rotates the refresh token and sets the replacement cookie. Reuse of an invalidated token revokes the affected session's token family.

### `POST /auth/logout`

Revokes the current refresh-token session and clears its cookie.

Response: `204 No Content`

Other device sessions remain active. The current access token may remain valid until expiration.

### `GET /auth/me`

Returns the authenticated user's public profile.

Response: `200 OK`

```json
{
  "data": {
    "id": "671234567890abcdef123456",
    "name": "Sara Ahmed",
    "email": "sara@example.com",
    "role": "employee",
    "isActive": true
  }
}
```

### Authentication implementation requirements

- Use Argon2id password hashing.
- Refresh tokens are stored as hashes in the database.
- Refresh cookies use appropriate `HttpOnly`, `Secure`, `SameSite`, path, and expiration settings.
- Use appropriate CSRF protection for cookie-based refresh operations.
- Deactivated users cannot log in or refresh.
- Deactivating an account revokes all its refresh-token sessions.
- Logout revokes only the current session.
- The backend must verify the account's active status and enforce permissions.
- Access tokens remain in frontend memory, not `localStorage`.

The exact cookie name, cookie path, CSRF mechanism, and development-versus-production cookie settings must be settled during implementation without weakening these security requirements.

### Approved cookie and CSRF defaults

The refresh cookie is named `refreshToken`, scoped to `Path=/api/auth`, `HttpOnly`, `SameSite=Lax`, `Secure` in production (HTTPS required), with a 7-day `Max-Age` aligned to the refresh-token lifetime. Rotation writes the replacement cookie in the same step that rotates the stored session token. CSRF protection combines `SameSite=Lax` (cross-site requests cannot carry the cookie) with verification of the request's `Origin`/`Referer` against the allowed frontend origin on refresh and logout. In local development over plain HTTP, `Secure` is disabled for the cookie to function; any deployed environment must run over HTTPS with `Secure` enabled.

## 3. User management

Admin only.

### `GET /users`

List users with pagination.

Supported query parameters:

- `page`
- `limit`
- `search` — name or email
- `role` — `admin` or `employee`
- `isActive` — `true` or `false`
- `sortBy` — `name`, `email`, `role`, `createdAt`
- `sortOrder` — `asc` or `desc`

### `GET /users/:id`

Get a user's public profile and account status.

### `PATCH /users/:id/role`

Request:

```json
{
  "role": "admin"
}
```

Only admins can change roles. Public registration cannot promote an account.

### `PATCH /users/:id/status`

Request:

```json
{
  "isActive": false
}
```

Deactivation revokes all refresh-token sessions. The backend must define and test safeguards against accidentally disabling the last usable administrator account.

Users are deactivated rather than permanently deleted, preserving historical references.

## 4. Products

Admins and employees can list, view, create, and edit products. Only admins can archive products.

### Product response

Employee representation:

```json
{
  "id": "671234567890abcdef123456",
  "name": "USB-C Cable",
  "sku": "SKU-001",
  "description": "Braided USB-C charging cable",
  "category": {
    "id": "671234567890abcdef123457",
    "name": "Electronics",
    "isArchived": false
  },
  "sellPriceCents": 1999,
  "stockQty": 120,
  "reservedQty": 15,
  "availableQty": 105,
  "lowStockThreshold": 5,
  "image": {
    "url": "https://example.com/image.webp",
    "publicId": "stockflow/product-image"
  },
  "isArchived": false,
  "createdAt": "2026-10-28T12:30:00.000Z",
  "updatedAt": "2026-10-28T12:30:00.000Z"
}
```

Admins receive `costPriceCents` in addition to these fields. Employees must never receive cost-price data in product responses, order responses, dashboard responses, or related endpoints.

`availableQty` is computed as `stockQty - reservedQty`. It must never be negative.

### `GET /products`

Supported query parameters:

- `page`, `limit`
- `search` — name, SKU, or description
- `categoryId`
- `stockStatus` — `all`, `in_stock`, `low_stock`, `out_of_stock`
- `sortBy` — `name`, `sku`, `sellPriceCents`, `stockQty`, `createdAt`
- `sortOrder` — `asc` or `desc`
- `includeArchived` — admin only

`stockStatus` is defined on a physical-stock basis (`stockQty`) and its values are mutually exclusive:

- `in_stock` — `stockQty > 0`
- `low_stock` — `stockQty > 0` and `stockQty ≤ lowStockThreshold`
- `out_of_stock` — `stockQty = 0`

The dashboard low-stock metric is computed separately and does include out-of-stock products, per the project brief.

Default pagination is page 1, 10 items per page. The server enforces a maximum page size.

Archived products are excluded by default. Employees cannot request archived products for the purpose of bypassing order restrictions, though historical order references remain visible.

### `GET /products/:id`

Return one product. Cost price is included only for admins.

### `POST /products`

Admin request:

```json
{
  "name": "USB-C Cable",
  "sku": "SKU-001",
  "description": "Braided USB-C charging cable",
  "categoryId": "671234567890abcdef123457",
  "sellPriceCents": 1999,
  "costPriceCents": 800,
  "stockQty": 120,
  "lowStockThreshold": 5,
  "image": {
    "url": "https://example.com/image.webp",
    "publicId": "stockflow/product-image"
  }
}
```

Response: `201 Created`

`costPriceCents` is admin-only. Only admins may view, set, or modify it; employees can never set or overwrite it.

- Only admin requests may include `costPriceCents`. An employee request containing it is rejected with `403 Forbidden`, not silently ignored.
- When an employee creates a product, `costPriceCents` defaults to `0` (employee requests must omit it) and an admin sets it afterwards through `PATCH /products/:id`.
- When an admin creates a product, `costPriceCents` is required and must be a nonnegative integer. When present in any admin request, it must be a nonnegative integer.

The server must validate all fields and confirm that the category exists and is not archived.

### `PATCH /products/:id`

Updates permitted product fields. Fields not provided remain unchanged.

Rules:

- SKU remains unique.
- Prices must be nonnegative integer cents.
- Stock and threshold values must be nonnegative integers.
- A manual change to `stockQty` is not permitted through this endpoint. Use the stock-adjustment endpoint instead.
- `reservedQty`, `availableQty`, and audit history are not directly writable by clients.
- `costPriceCents` may appear only in admin requests. Employee requests containing it are rejected with `403 Forbidden`. Admins may update it freely.
- Product edits do not change historical order snapshots.

### `POST /products/:id/archive`

Admin only. Archives the product without deleting historical order references.

Archived products cannot be added to new orders.

## 5. Categories

Admins and employees can create and rename categories. Only admins can archive them.

### `GET /categories`

Returns categories. Support `page`, `limit`, `search`, and an optional `includeArchived` filter.

Archived categories may be shown to explain existing product references but cannot be selected for new products.

### `POST /categories`

Request:

```json
{
  "name": "Electronics"
}
```

Response: `201 Created`

Category names are required, trimmed, and unique under the approved case-normalization policy.

### `PATCH /categories/:id`

Request:

```json
{
  "name": "Cables and Accessories"
}
```

Renames a category. Existing products keep the same category reference.

### `POST /categories/:id/archive`

Admin only. Archives the category without archiving or hiding its existing products.

Permanent deletion of referenced categories is not supported.

## 6. Inventory adjustments and history

### `POST /products/:id/adjustments`

Admins and employees can make manual stock adjustments.

Request:

```json
{
  "quantityDelta": 10,
  "reason": "Received new shipment"
}
```

`quantityDelta` must be a nonzero integer. Positive values increase stock; negative values decrease stock.

The backend must reject an adjustment that would make physical stock negative or leave physical stock insufficient to cover reservations.

Response: `201 Created`

```json
{
  "data": {
    "productId": "671234567890abcdef123456",
    "stockQty": 130,
    "reservedQty": 15,
    "availableQty": 115,
    "movement": {
      "id": "671234567890abcdef123458",
      "type": "manual_adjustment",
      "quantityDelta": 10,
      "reservedDelta": 0,
      "reason": "Received new shipment",
      "createdAt": "2026-10-28T12:30:00.000Z"
    }
  }
}
```

The actor is derived from the authenticated session, never trusted from the request body.

### `GET /inventory/movements`

Admins and employees can view inventory movement history.

Supported query parameters:

- `page`, `limit`
- `productId`
- `orderId`
- `type`
- `from`, `to` — date range
- `sortOrder` — `asc` or `desc`

Each movement includes the product reference, movement type, quantity and reservation deltas, actor, timestamp, reason when applicable, and related order when applicable.

### `GET /products/:id/movements`

Returns the movement history for a particular product.

Movement records are immutable through the public API. No update or delete endpoints are provided.

## 7. Orders

Admins and employees can create, view, confirm, and cancel eligible orders, subject to the approved status transitions. **Only admins can ship confirmed orders.**

### Order response

Employee representation:

```json
{
  "id": "671234567890abcdef123456",
  "orderNumber": "ORD-000123",
  "status": "pending",
  "customer": {
    "name": "Sara Ahmed",
    "email": "sara@example.com"
  },
  "lines": [
    {
      "productId": "671234567890abcdef123457",
      "productName": "USB-C Cable",
      "sku": "SKU-001",
      "quantity": 3,
      "unitSellPriceCents": 1999,
      "lineSellTotalCents": 5997
    }
  ],
  "totalSellCents": 5997,
  "createdByUserId": "671234567890abcdef123458",
  "confirmedByUserId": null,
  "createdAt": "2026-10-28T12:30:00.000Z",
  "confirmedAt": null,
  "shippedAt": null,
  "cancelledAt": null
}
```

Admins also receive `unitCostPriceCents` and `totalCostCents`. These fields must be omitted from employee responses, not merely hidden in the frontend.

Historical line snapshots and totals are immutable after order creation.

### `GET /orders`

Supported query parameters:

- `page`, `limit`
- `search` — order number, order ID, or customer name/email
- `status` — `pending`, `confirmed`, `shipped`, `cancelled`
- `from`, `to` — order creation date range
- `sortBy` — `createdAt`, `confirmedAt`, `orderNumber`, `totalSellCents`
- `sortOrder` — `asc` or `desc`

Default sorting is newest first. The server enforces the maximum page size.

### `POST /orders`

Request:

```json
{
  "customer": {
    "name": "Sara Ahmed",
    "email": "sara@example.com"
  },
  "lines": [
    {
      "productId": "671234567890abcdef123457",
      "quantity": 3
    }
  ]
}
```

Customer name is required; email is optional. The server calculates prices and totals from current product data rather than trusting client-supplied prices.

Rules:

- At least one line is required.
- Quantities must be positive integers.
- Duplicate product IDs within a single order are rejected (approved decision: reject, do not combine). Duplicate lines return `409 Conflict` with error code `DUPLICATE_ORDER_LINE`.
- Products must exist, be active, and have sufficient available stock.
- Reserve stock atomically during order creation.
- Save selling-price and cost-price snapshots.
- Generate a unique human-readable order number, formatted `ORD-` followed by a zero-padded sequence (e.g., `ORD-000123`), taken from a dedicated `counters` collection incremented with `$inc` inside the same order-creation transaction. `orders.orderNumber` carries a unique index.
- The order starts with status `pending`.
- Create the order, update reservations, and write movement records in one transaction.

Response: `201 Created`

The response contains the created order, including its order number and current status.

Insufficient stock returns `409 Conflict` with error code `INSUFFICIENT_STOCK`. No partial order or partial reservation may remain.

### `GET /orders/:id`

Returns an order by MongoDB ID.

### `GET /orders/number/:orderNumber`

Returns an order by human-readable order number.

The order number is unique and generated by the server.

### `POST /orders/:id/confirm`

Transitions a pending order to confirmed.

Rules:

- Only pending orders can be confirmed.
- Finalize stock deduction without deducting reserved units twice.
- Record `confirmedAt` and `confirmedByUserId`.
- Update stock counters and inventory history in the same transaction.
- A concurrent duplicate confirmation must not apply stock changes twice.

Response: `200 OK` with the updated order.

### `POST /orders/:id/ship`

Admin only. Transitions a confirmed order to shipped. Employee requests receive `403 Forbidden`.

Rules:

- Only confirmed orders can be shipped.
- Record `shippedAt`.
- Stock was already deducted at confirmation, so shipping does not deduct it again.
- Shipped orders are final.

Response: `200 OK` with the updated order.

### `POST /orders/:id/cancel`

Cancels an eligible order.

Rules:

- Pending orders release reserved stock.
- Confirmed orders restore stock before shipping.
- Shipped and already cancelled orders cannot be cancelled.
- Record `cancelledAt`.
- Update stock counters and inventory history in the same transaction.
- Only one concurrent state transition may succeed.

Response: `200 OK` with the updated order.

### Order update policy

Order lines, quantities, and price snapshots cannot be edited after creation. To change products or quantities, cancel an eligible order and create a new one.

## 8. Dashboard and analytics

All dashboard endpoints require authentication. Cost-sensitive fields and metrics are admin-only.

### `GET /dashboard/summary`

Query parameters:

- `preset` — `today`, `last7days`, `last30days`, `thisMonth`, `custom`
- `from`, `to` — required when `preset=custom`

Proposed response:

```json
{
  "data": {
    "totalRevenueCents": 125000,
    "totalOrders": 42,
    "activeProducts": 25,
    "lowStockProducts": 4,
    "pendingOrders": 6,
    "averageOrderValueCents": 31250
  }
}
```

Admins additionally receive:

```json
{
  "totalInventoryValueAtCostCents": 875000
}
```

Metric rules:

- Revenue includes confirmed and shipped orders, attributed to confirmation date.
- Total orders counts all orders created in the selected date range, regardless of status.
- Active products are non-archived products with physical stock greater than zero.
- Low-stock products are counted using each product's threshold and physical stock quantity.
- Pending orders is a current-state operational count, not scoped to the selected date range.
- AOV is gross revenue divided by the count of confirmed and shipped orders attributed to confirmation date. Return zero when there are no qualifying orders.
- Inventory value at cost sums physical on-hand quantity multiplied by cost price for all non-archived products, including reserved units.

### `GET /dashboard/revenue`

Returns revenue grouped by date for the selected period.

Query parameters follow the same date-filter convention as the summary endpoint.

Each data point includes a date and `revenueCents`. Only confirmed and shipped orders are included, attributed to confirmation date.

### `GET /dashboard/top-products`

Returns top-selling products for the selected period.

Query parameters:

- `preset`, `from`, `to`
- `limit` — optional, with a server-enforced maximum

Each result includes product reference, product name, units sold, and revenue in cents. Count only confirmed and shipped orders, attributed by confirmation date.

### `GET /dashboard/recent-orders`

Returns the most recent orders, including order number, customer, total, status, and creation time.

Query parameters:

- `limit` — optional, with a server-enforced maximum

Cost-sensitive fields remain admin-only.

### `GET /dashboard/low-stock`

Returns products at or below their low-stock threshold, including out-of-stock products.

Support pagination and an optional category filter.

## 9. Image uploads

Product images may be JPEG, PNG, or WebP, with a maximum size of 5 MB.

Proposed endpoint:

### `POST /uploads/product-image`

Admins and employees may upload images for products they are allowed to manage.

The upload mechanism must validate file type and size on the backend and store images in Cloudinary or an approved equivalent. Credentials must remain server-side.

### Approved upload mechanism

Backend-mediated multipart upload: the client sends `multipart/form-data` with a single `image` field; the backend parses the multipart body, enforces the 5 MB limit, and verifies the file content (magic bytes) rather than trusting the client-declared MIME type, accepting only JPEG, PNG, and WebP. The backend then streams the file to Cloudinary using server-side credentials and returns an image object containing `{ url, publicId }`. The browser never receives a secret Cloudinary API key.

Implementation note: a multipart parser is required for this; `multer` is a lean, ordinary, maintained choice.

The resulting product image object contains its URL and relevant public metadata. Uploaded images that are never attached to a product may need cleanup, but a complete asset-management subsystem is outside the MVP scope.

## 10. Shared pagination, filtering, and sorting

For paginated endpoints:

- `page` defaults to `1`.
- `limit` defaults to `10`.
- Both must be positive integers.
- The server enforces a maximum limit.
- Responses include `page`, `limit`, `totalItems`, and `totalPages`.
- Empty result sets return an empty `data` array and `totalPages: 0`.

Filtering and sorting must use explicit allowlists. The server must not pass arbitrary client-supplied field names into MongoDB queries.

Search inputs must be handled safely and must not allow clients to inject arbitrary MongoDB operators or expressions.

Date ranges use ISO 8601 with all boundaries interpreted in **UTC** — the single business timezone for all date filtering, including presets. For date-only `from`/`to` values, `from` is inclusive from `00:00:00.000Z` of the given date, and `to` is inclusive through `23:59:59.999Z` of the given date. Timestamp values are used as given. Dashboard presets (`today`, `last7days`, `last30days`, `thisMonth`) are computed on UTC calendar boundaries and applied consistently: order creation scopes `totalOrders`, and confirmation dates scope revenue, AOV, and top products.

## 11. Business invariants

These rules apply regardless of which endpoint is used:

1. Backend validation is authoritative.
2. Employees never receive cost-sensitive fields, and only admins can read `costPriceCents`. Only admin requests may set or modify `costPriceCents`; employee requests containing it are rejected.
3. Clients cannot directly write `reservedQty`, `availableQty`, order totals, order prices, order numbers, actor IDs, or inventory-history records.
4. Product and category archival preserves historical references.
5. Order prices and totals are snapshots and do not change when products are edited.
6. Order transitions follow the approved transition table. Only admins may ship orders.
7. Stock reservations and stock movements must be consistent with order state.
8. Concurrent requests must not oversell stock or apply stock movements twice.
9. Order creation, reservation, cancellation, confirmation, and corresponding movement records must be transactionally consistent.
10. User deactivation prevents login and refresh and revokes refresh sessions.
11. No public registration flow can create an admin.
12. Cost-sensitive metrics must be protected by backend authorization.
13. Human-readable order numbers must be unique under concurrent creation.
14. Archived products cannot be added to new orders.
15. Shipped and cancelled orders are final.

## 12. Resolved implementation decisions (owner-approved defaults)

The previously open implementation details have been resolved with the following approved defaults. Each is documented in place in the relevant section above.

1. **Database platform and transactions:** MongoDB Atlas free tier (M0) replica set, supporting the multi-document transactions the order and stock workflows require. The connection string is supplied only via environment variables and is never committed. Free-tier limits (512 MB storage, ~100 concurrent connections, shared cluster) are acceptable for a portfolio MVP.
2. **Order numbers:** generated from a dedicated `counters` collection (`{ key: "orderNumber" }`) with `$inc` inside the same transaction that creates the order; `orders.orderNumber` has a unique index. Counter values are not exposed through the API.
3. **Date and timezone convention:** UTC boundaries per §10.
4. **Refresh cookie and CSRF:** `refreshToken` cookie, `HttpOnly`, `SameSite=Lax`, `Secure` in production, `Path=/api/auth`, 7-day `Max-Age` per §2; CSRF protection via `SameSite` plus `Origin`/`Referer` verification. Security requirements are not weakened.
5. **Image uploads:** backend-mediated multipart with content-type and size validation; `multer` noted as the required multipart parser (§9).
6. **Stock-status filter basis:** physical stock (`stockQty`), with mutually exclusive `in_stock` / `low_stock` / `out_of_stock` definitions (§4).
7. **User sorting:** allowlist `name`, `email`, `role`, `createdAt` (§3).
8. **Customers:** orders embed `customer: { name (required), email (optional) }`; no separate customer entity in the MVP (§7).
9. **Audit surface:** ordinary inventory-movement history is exposed through the §6 endpoints only; security internals (refresh sessions, token hashes, counters) are never exposed. No additional audit-metadata endpoints for the MVP.

No blocking decisions remain for backend implementation. Demo seed data, recruiter demo credentials, and final production deployment remain separately planned and do not gate core development.

## 13. Change Log

- v1.0 (draft reviewed): Initial contract draft circulated for owner review. No business decisions in this version were silently applied; every proposed rule traced to `StockFlow_Project_Brief.md` or was explicitly labeled a proposal.
- v1.1 (owner decisions applied):
  - **Admin-only shipping.** `/orders/:id/ship` is restricted to admins; employees receive `403 Forbidden`. §7 intro and §11 invariant 6 updated.
  - **Duplicate order lines rejected.** Confirms the draft's reject behavior as an approved decision; added error code `DUPLICATE_ORDER_LINE` (`409 Conflict`). The brief allowed combine-or-reject; rejection is now the approved rule.
  - **`costPriceCents` is admin-only to view, set, or modify.** §4 `POST /products` and `PATCH /products/:id` updated: employee requests containing it are rejected with `403 Forbidden` rather than silently ignored. Employee-created products start with cost `0` until an admin sets it (derived consequence; see Remaining decisions). §11 invariant 2 updated accordingly.
- v1.2 (remaining decisions resolved with owner-approved defaults):
  - **UTC date boundaries** for all presets and custom ranges, including inclusive `from`/complete `to` semantics (§10).
  - **Order numbers** generated atomically from a dedicated `counters` collection with a unique index on `orders.orderNumber` (§7, §12). Note: this adds a `counters` collection to the previously proposed database schema.
  - **MongoDB Atlas free tier (M0)** approved as the database platform (§12).
  - **Refresh cookie and CSRF approach finalized** (§2): `refreshToken` cookie, `HttpOnly`, `SameSite=Lax`, `Secure` in production, plus `Origin`/`Referer` verification.
  - **Backend-mediated multipart uploads approved**; `multer` documented as the required multipart parser (§9, §12).
  - **`stockStatus` filter defined on a physical-stock basis** with mutually exclusive values (§4).
  - **`GET /users` sort allowlist finalized** as `name`, `email`, `role`, `createdAt` (§3).
  - **Customer representation finalized** as embedded `{ name, email? }`; no separate customer entity (§7, §12).
  - **Audit surface finalized**: movement history public, security internals never exposed via API (§12).
