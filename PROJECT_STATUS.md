# StockFlow — Project Status Resume

**Purpose:** Living snapshot of where the project is, kept so any agent (or the owner) can resume work quickly without re-reading the whole history. OpenCode updates this after each completed increment. For requirements and rules, `StockFlow_Project_Brief.md` and `AGENTS.md` remain the source of truth.

**Last updated:** 2026-10-29 (after the models-layer increment)
**Phase:** Backend implementation — core setup and database models done; authentication is the next increment.

---

## 1. Timeline — what happened, in order

| # | Milestone | Result |
|---|---|---|
| 1 | Read `AGENTS.md` + `StockFlow_Project_Brief.md`; inspected repo (only the two docs existed) | Done |
| 2 | **Database schema proposal** presented for owner review (6 collections, indexes, consistency mechanics, open decisions §6) — review only, nothing implemented | Presented; owner later approved via contract decisions |
| 3 | **API contract v1.0 draft** reviewed against brief and schema | No conflicts found; deltas and decisions flagged to owner |
| 4 | **Owner approved 3 decisions:** admin-only shipping; duplicate order lines rejected; `costPriceCents` admin-only (view/set/modify) | Applied |
| 5 | **Contract saved as `docs/api-contract.md`** (Draft v1.1, change log added) | Done |
| 6 | **Owner approved remaining defaults:** UTC boundaries; `counters` collection + unique index for order numbers; MongoDB Atlas M0; HttpOnly refresh cookie w/ rotation + CSRF; backend multipart uploads (`multer`); `in_stock` on physical stock; user sort allowlist; embedded customer `{name, email?}`; movements public / security internals private | Applied |
| 7 | **Contract updated to v1.2** with all decisions in place (change log §13) | Done |
| 8 | **Backend skeleton (TypeScript + Express)**: package scripts, env validation, MongoDB connection config, health-check, error envelope | Done, checks passed |
| 9 | **TypeScript migration**: `tsconfig` moved from deprecated `moduleResolution: node` (node10) to `module: nodenext` + `moduleResolution: nodenext` (owner's IDE flagged it; CommonJS output unchanged) | Done, checks passed |
| 10 | **Mongoose models layer** (7 collections incl. contract's `counters`) + in-memory sanity checks | Done, 13/13 passed |

## 2. Approved decisions registry (owner decisions, do not change silently)

**Business rules** (from the brief): order statuses `pending → confirmed | cancelled`, `confirmed → shipped | cancelled`; shipped/cancelled final; reservation-on-create, deduction-on-confirm, release/restock-on-cancel; pending orders never expire; manual adjustments require reasons; archived ≠ deleted; employees never see cost data.

**Contract decisions (v1.1):**
- Only admins can **ship** orders (employees get `403`).
- **Duplicate** product IDs within an order are **rejected** (`409`, code `DUPLICATE_ORDER_LINE`) — not combined.
- `costPriceCents` readable/writable **by admins only**; employee requests containing it → `403`, never silently ignored; employee-created products default cost `0` until an admin sets it.

**Contract decisions (v1.2 defaults):**
- Date boundaries in **UTC**; `from` inclusive `00:00:00.000Z`, `to` inclusive through `23:59:59.999Z`.
- Order numbers `ORD-######` from a transactional **`counters` collection**; unique index on `orders.orderNumber`; adds a 7th collection to the schema.
- **MongoDB Atlas free tier (M0)** is the database platform; connection string only via env vars.
- Refresh cookie `refreshToken`, `Path=/api/auth`, `HttpOnly`, `SameSite=Lax`, `Secure` in production (disabled only in plain-HTTP dev), 7-day Max-Age; CSRF = SameSite + `Origin`/`Referer` verification.
- Image uploads: **backend-mediated multipart**, 5 MB limit, magic-byte validation (JPEG/PNG/WebP), `multer` as the parser.
- `stockStatus` on **physical stock**: `in_stock > 0`; `low_stock = 0 < stockQty ≤ threshold`; `out_of_stock = 0`.
- `GET /users` sort allowlist: `name`, `email`, `role`, `createdAt`.
- Customer embedded in orders: `{ name (required), email (optional) }`; no customer entity in MVP.
- Movement history exposed via API; sessions/hashes/counters are never exposed.

## 3. Database schema (implemented as backend/src/models)

7 collections — `users`, `refresh_sessions`, `categories`, `products`, `orders`, `stock_movements`, `counters`. Money is **integer cents (USD)** everywhere. Reservations are an embedded `reservedQty` counter on products (`availableQty = stockQty − reservedQty`, also a virtual).

| Model | Key points |
|---|---|
| `User` | unique case-insensitive email (lowercase stored), Argon2id `passwordHash` (never serialized), `role` enum (default `employee`), `isActive` soft-disable |
| `RefreshSession` | unique `tokenHash`, TTL index on `expiresAt` (7 days), `familyId` for family revocation, `status`: active/rotated/revoked |
| `Category` | unique case-insensitive name, `isArchived` (archive, never delete) |
| `Product` | unique uppercase SKU, integer-cents prices, `stockQty`/`reservedQty`/`lowStockThreshold` (default 5) integer-validated, `availableQty` virtual, `isArchived`, Cloudinary image `{url, publicId}` |
| `Order` | unique `orderNumber`, status enum, immutable line snapshots (name/sku/unit prices/totals), embedded `customer`, `confirmedAt/shippedAt/cancelledAt`, indexes for status/date + confirmation-date dashboards |
| `StockMovement` | create-only (no `updatedAt`), types: `manual_adjustment/order_reserve/order_confirm/order_release/order_restore`, `reason` required only for manual, `quantityDelta` nonzero only for manual |
| `Counter` + `nextOrderNumber(session?)` | atomic `$inc` upsert inside the order-creation transaction; rollback-safe (numbers never gap) |

Central helpers: `src/models/types.ts` (enums + `ALLOWED_ORDER_TRANSITIONS`), `src/models/serialize.ts` (`registerApiToJSON` — `_id→id`, strips `__v` + secret fields).

**Consistency design (be implemented in services, not yet built):** MongoDB transactions + conditional atomic updates. Order creation: `updateOne({ _id, stockQty: { $gte: reservedQty + qty } }, { $inc: { reservedQty: qty } })` per line, else abort → `409 INSUFFICIENT_STOCK`. Every transition is guarded by `updateOne({ _id, status: <from> }, { $set: { status: <to> } })` so concurrent duplicate transitions cannot double-apply. Counters, order doc, and movements always commit in one transaction.

## 4. Current backend state (`backend/`)

```
backend/
├── package.json         # dev | build | start | typecheck  (Node ≥ 20)
├── tsconfig.json        # strict, node16 output, nodenext resolution (Migrated off deprecated node10)
├── .env.example         # PORT, NODE_ENV, MONGODB_URI, FRONTEND_ORIGIN
├── .gitignore           # node_modules/, dist/, .env — never commit
└── src/
    ├── server.ts        # entry: HTTP listen, non-blocking DB connect, graceful shutdown
    ├── app.ts           # Express 5 factory: JSON limit, /api mount, 404 + error handlers
    ├── config/env.ts    # fail-fast validation (MONGODB_URI format-checked, PORT integer, NODE_ENV enum)
    ├── config/db.ts     # Mongoose connect w/ 5s retry loop; never logs the URI; getDatabaseState()
    ├── middleware/errorHandler.ts  # ApiError + contract §1.4 envelope; no stack traces leaked
    ├── routes/index.ts  # /api mount point (future routers land here)
    ├── routes/health.ts # GET /api/health → {data:{status, database, uptimeSeconds, timestamp}}
    └── models/          # ← models layer (see §3)
```

**Runtime behavior:** server boots even if MongoDB is down; `/api/health` reports live connection state and connect attempts retry every 5s. Verified over plain HTTP in dev (`Secure` cookie note applies to auth later, not now).

**Dependencies installed:** `express` ^5, `mongoose` ^8, `dotenv`; dev: `typescript`, `tsx`, type packages. *(Pending, to be flagged before installing: `argon2` (Argon2id hashing) and `jsonwebtoken` at the auth step, Jest/Supertest when tests start, `multer` at the uploads step.)*

## 5. Verified checks log

| When | Check | Result |
|---|---|---|
| After skeleton | `npm install` | ✅ 0 vulnerabilities (npm notes blocked `esbuild` postinstall; harmless, tsx runs) |
| After skeleton | `npm run typecheck`, `npm run build` | ✅ (caught + fixed 1 unused import) |
| After skeleton | booted dev server: `GET /api/health` 200; unknown route → `404 {"error":{"code":"NOT_FOUND"...}}`; missing env → fail-fast exit | ✅ |
| After nodenext migration | typecheck + build + compiled run + health | ✅ no warnings |
| After models | typecheck + build | ✅ (fixed Mongoose strict `toJSON` typing via helper; `validateSync` skips pre-`validate` hooks → array rule implemented as path validator) |
| After models | in-memory sanity script: 13/13 (model registration, email lowercase, hash never in JSON, integer-cents rejection, SKU uppercase, cost default 0, availableQty, empty-lines rejection, invalid status, manual-reason rule, nonzero-delta rule, order-number format, transition table) | ✅ deleted afterwards; Jest tests will re-cover |

Nothing has been claimed tested beyond this log. No database round-trip has run yet (no Atlas URI configured in this environment) — first service-level tests must cover indexes, TTL, collation, and the counter-in-transaction behavior.

## 6. Next steps (agreed sequence — do not skip ahead without approval)

1. **Auth layer** (next): register/login/refresh/logout/me per contract §2 — rotation + family revocation, deactivation checks, last-admin safeguard on user management routes. Requires installing `argon2` + `jsonwebtoken` (flag: ordinary, maintained, needed per the approved stack).
2. Mongoose schema round-trip tests (Jest + Supertest, in-memory or Atlas M0) — cover the consistency design above.
3. Products/categories CRUD + archival + stock endpoint + movements read endpoints (contract §4–6).
4. Orders service with transactions (contract §7) + concurrency tests.
5. Dashboard aggregation endpoints (contract §8, role-gated cost metrics).
6. Uploads (contract §9) after Cloudinary credentials are provided by the owner.
7. Later, separately planned: seed/demo data, recruiter demo credentials, frontend integration (Antigravity), deployment.

## 7. Open items / watch-outs

- Frontend work (`frontend/`) has not started; Antigravity was expected to use mock data against this contract.
- Contract exact cookie/CSRF mechanics are settled at the *policy* level (§2 v1.2); the actual middleware implementation arrives with the auth increment.
- `docs/api-contract.md` is v1.2, awaiting the owner's final nod that it is *the* reference — no new edits until then.
- Repo convention going forward: update this file after each completed increment; one editor at a time (currently OpenCode).
