# StockFlow — Project Brief

## 1. Project Overview

**Project name:** StockFlow — Inventory & Order Management

**Purpose:** Build a full-stack inventory and order management application suitable for a software development portfolio.

StockFlow should demonstrate practical full-stack development through a usable MVP featuring authentication, role-based permissions, inventory and category management, order workflows, a business dashboard, validation, and automated tests.

This document records the requirements and technical decisions agreed upon so far. It is the shared reference for the project owner, Antigravity, and OpenCode.

### Important rules

- Follow explicitly approved requirements and business rules.
- Do not treat undecided implementation details as approved decisions.
- Do not invent major architecture decisions, database schemas, API contracts, or features without the project owner's approval.
- Use practical defaults for small implementation details that do not change approved behavior.
- Ask the owner when a decision affects business behavior, security, data integrity, major dependencies, or coordination between the frontend and backend.
- Keep this project focused on a portfolio MVP. Avoid unnecessary enterprise-level complexity and premature optimization.
- Inspect the existing repository before making changes. Preserve existing work.

---

## 2. Approved Technology Stack

### Frontend

- React.js
- TypeScript
- Tailwind CSS
- React Router
- GSAP for purposeful, restrained animations
- Vitest and React Testing Library for frontend tests

### Backend

- Node.js
- TypeScript
- Express.js
- MongoDB with Mongoose
- JWT authentication
- Argon2id for password hashing
- Jest and Supertest for backend tests

### Supporting services

- Cloud image storage, such as Cloudinary, for product images.
- Store image URLs and relevant metadata in MongoDB rather than storing image binaries directly in MongoDB.

Do not replace the agreed stack or introduce major dependencies without explaining the reason and obtaining owner approval.

Choose ordinary, maintained packages for routine implementation needs. Keep the dependency list lean.

### API communication

The agreed API communication approach is:

- REST API
- JSON request and response bodies
- `/api/...` endpoint convention, without an `/api/v1` prefix for this MVP
- TypeScript on both frontend and backend

The concrete endpoint paths, request and response schemas, error format, and shared TypeScript contracts must be documented in `docs/api-contract.md` and approved before frontend/backend integration.

---

## 3. Roles and Permissions

StockFlow has two roles:

- **Admin**
- **Employee**

Permissions must be enforced on the backend. Hiding a button or page in the frontend is not authorization.

### Admin

Admins can:

- Create and edit products.
- Archive products.
- Create and rename categories.
- Archive categories.
- Create and manage orders.
- Perform manual stock adjustments.
- View cost prices and cost-sensitive dashboard metrics.
- Manage user accounts and roles.
- Promote employees to admin.
- Deactivate user accounts.
- Perform the inventory and order actions permitted by the business rules.

### Employee

Employees can:

- Create and edit products.
- View inventory and product information.
- Create and rename categories.
- Create, view, confirm, and cancel eligible orders.
- Perform manual stock adjustments.
- View operational dashboard metrics and inventory alerts.

Employees cannot:

- Manage user accounts or assign roles.
- Archive products or categories.
- View product cost prices.
- View inventory value at cost or other cost-sensitive metrics.

Enforce these restrictions at the API level as well as in the frontend.

---

## 4. Authentication and Account Management

### Registration and login

- Users can register and log in.
- Public registration creates employee accounts only.
- Users cannot choose or assign themselves the admin role during public registration.
- Newly registered employees can log in immediately.
- Existing admins can promote employees to admin or deactivate accounts.
- Protected API routes require authentication.
- Role-restricted operations require the appropriate authorization.

### Token lifecycle

The approved authentication requirements are:

- Access JWT lifetime: **15 minutes**.
- Refresh token lifetime: **7 days**.
- Refresh tokens rotate when used to refresh a session.
- Refresh tokens are stored in secure HttpOnly cookies with appropriate `Secure`, `SameSite`, and CSRF protections.
- Access tokens remain in frontend memory rather than `localStorage`.
- Passwords are hashed using Argon2id.

### Logout and token reuse

- Logging out revokes the current refresh-token session only.
- Other device sessions remain active.
- The current access token may remain valid until its expiration.
- Detect reuse of an invalidated refresh token and revoke the affected session's token family.
- Require reauthentication for the affected session. Other device sessions may remain active.

### Deactivated accounts

- Deactivated users cannot log in or refresh tokens.
- Deactivation revokes all refresh-token sessions belonging to that user.
- Already-issued short-lived access tokens may remain valid until they expire.
- Account removal means deactivation rather than permanent deletion, preserving historical order and audit references.

Never store or log plaintext passwords. Never expose secrets in logs, commits, screenshots, or documentation.

The implementation details of session storage and revocation must support these behaviors. Propose the concrete implementation if it materially affects the database design or security.

---

## 5. Product and Inventory Management

### Product fields

Each product should support:

- Name
- Unique SKU
- Description
- Category reference
- Selling price in USD
- Cost price in USD
- Physical stock quantity
- Per-product low-stock threshold
- Product image URL and relevant image metadata
- Archived/active state

The concrete Mongoose schema, indexes, and field-level implementation details must be proposed for review before database schema implementation.

### Product permissions and lifecycle

- Admins and employees can create and edit products.
- Only admins can archive products.
- Archived products remain available for historical order references.
- Archived products cannot be added to new orders.
- Editing or archiving a product must not change historical order prices or totals.
- Prefer archiving over permanent deletion when historical references exist.

### Validation

Validate data on both frontend and backend. Backend validation is authoritative.

- Name, SKU, and category are required.
- SKU must be unique.
- Selling price and cost price must be greater than or equal to zero.
- Stock quantity and low-stock threshold must be nonnegative whole numbers.
- Product images may be JPEG, PNG, or WebP.
- Maximum image file size: **5 MB**.
- Validate image type and size before upload on the frontend and backend.
- Use a cloud image service such as Cloudinary for uploads.
- Never expose cloud-service credentials to the browser.

### Stock adjustments and audit history

Admins and employees can manually increase or decrease stock.

Every manual adjustment requires a reason. The backend must:

- Validate the adjustment quantity.
- Prevent negative stock.
- Prevent adjustments that would leave physical stock insufficient to cover reserved quantities.
- Record the actor, timestamp, quantity change, reason, and related order where applicable.
- Maintain an auditable history of manual adjustments and order-related stock movements.
- Prevent ordinary users from editing or deleting inventory history records.

### Low-stock behavior

- Default low-stock threshold: **5 units**.
- Each product can have its own threshold.
- A low-stock alert triggers when the relevant stock quantity is less than or equal to the product's threshold.
- Out-of-stock products remain visible in inventory.
- Out-of-stock products are excluded from the Active Products dashboard metric.
- **Active Products** means non-archived products with physical stock greater than zero.

The concrete availability field or calculation used for low-stock filtering must be consistent with the approved stock-reservation rules and documented in the implementation.

---

## 6. Category Management

- Admins and employees can create and rename categories.
- Only admins can archive categories.
- Categories referenced by products must not be permanently deleted.
- Archived categories cannot be assigned to new products unless restored.
- Archiving a category does not archive, hide, or otherwise change its existing products.
- Existing products remain visible with their archived category reference.

The concrete category schema and its relationship with products must be included in the schema proposal for owner review.

---

## 7. Orders and Inventory Rules

### Order contents and pricing

- An order contains one or more product lines.
- Every order must contain at least one product.
- Quantities must be positive whole numbers.
- Products must exist and be active when an order is created.
- New orders cannot include out-of-stock products.
- Requested quantities cannot exceed available stock.
- Duplicate product lines must be handled consistently. Prefer combining duplicates or explicitly rejecting them instead of silently creating ambiguous lines.
- Save a snapshot of each line's selling price and cost price when the order is created.
- Later product edits must not change existing order prices, cost snapshots, or totals.

### Order statuses

The approved statuses are:

- `pending`
- `confirmed`
- `shipped`
- `cancelled`

Allowed transitions:

- `pending` → `confirmed`
- `pending` → `cancelled`
- `confirmed` → `shipped`
- `confirmed` → `cancelled`
- `shipped` and `cancelled` are final states.

Confirmed order products and quantities are locked. To change products or quantities before shipping, cancel the order and create a new one.

Shipped orders cannot be cancelled through the normal StockFlow workflow. Returns are out of scope for this MVP.

### Stock reservation and deduction

The approved stock behavior is:

1. **Order creation:** reserve the requested stock.
2. **Order confirmation:** finalize the stock deduction without deducting quantities already reserved a second time.
3. **Pending-order cancellation:** release the reserved stock immediately.
4. **Confirmed-order cancellation before shipping:** restore the stock.
5. **Shipping:** move the confirmed order to its final shipped state.
6. **Shipped orders:** do not allow cancellation or stock restoration through the normal order workflow.

Additional rules:

- Pending orders do not expire automatically.
- Admins and employees can view, confirm, and cancel eligible orders, subject to valid state transitions and stock rules.
- Either role can cancel a pending or confirmed order that has not shipped.
- Enforce all transitions and stock effects on the backend.
- Prevent simultaneous requests from overselling stock.
- If competing requests cannot both be fulfilled, reject the conflicting request or retry safely.
- Stock reservation, confirmation, cancellation, and inventory-history updates must remain consistent.
- Avoid partial updates and double application of stock movements.

The exact Mongoose models, transaction strategy, concurrency-control implementation, and stock accounting representation remain implementation details to propose and review before schema implementation. The business rules above are approved and must not be changed by the agents.

---

## 8. Dashboard and Analytics

The dashboard should display:

- Total revenue
- Total orders
- Active products
- Low-stock products
- Pending orders
- Total inventory value at cost — admin only
- Average order value
- Revenue trend chart
- Top-selling products, including units sold and revenue
- Recent orders
- Inventory and low-stock alerts

### Currency

Use **USD** consistently for product prices, order totals, revenue, and inventory value.

Multi-currency support and currency conversion are out of scope for this MVP.

### Date filters

Use one shared date filter for revenue and sales charts, with these presets:

- Today
- Last 7 Days
- Last 30 Days
- This Month
- Custom Range

Define and document consistent date-boundary behavior, including how custom range start and end dates are interpreted.

### Metric definitions

**Total revenue**

Gross selling-price totals from confirmed and shipped orders, attributed to the date the order was confirmed. Do not subtract costs.

**Total orders**

Count all orders created within the selected date range, regardless of status.

**Active products**

Count non-archived products with physical stock greater than zero.

**Low-stock products**

Count products at or below their individual low-stock threshold. Apply the agreed stock-availability semantics consistently.

**Pending orders**

Count orders currently in pending status. This is a current-state operational metric, not a date-scoped metric, even when a dashboard date filter is active.

**Total inventory value at cost**

Sum physical on-hand quantity multiplied by cost price across all non-archived products. Reserved units are still physically held and are included. This metric is visible to admins only.

**Average order value (AOV)**

Gross selling-price revenue divided by the number of confirmed and shipped orders in the selected date range, attributed by confirmation date. Exclude pending and cancelled orders. Display zero when there are no qualifying orders.

**Top-selling products**

Rank products by units sold and show revenue per product. Count only confirmed and shipped orders in the selected date range, attributed by confirmation date.

**Recent orders**

Show recent orders with useful order/customer information, totals, timestamps, and status where appropriate.

### Sensitive metrics

Only admins can see:

- Product cost prices
- Total inventory value at cost
- Any profit-related or other cost-sensitive metrics

Employees see selling prices and operational metrics only. Enforce these restrictions in backend responses as well as the UI.

---

## 9. Search, Filtering, Sorting, and Pagination

### Product list

Support:

- Search
- Category filtering
- Stock-status filtering
- Sorting
- Pagination

### Order list

Support:

- Search by order ID or customer
- Status filtering
- Date-range filtering
- Sorting
- Pagination

### Pagination convention

Use page-based pagination with `page` and `limit` query parameters.

Example:

`?page=1&limit=10`

Approved defaults:

- Default page: `1`
- Default page size: `10`
- Server-enforced maximum page size
- Paginated success responses include current page, page size, total items, and total pages.

Concrete query parameter names, sorting options, and response keys must be documented in the API contract.

---

## 10. API Contract and Error Handling

The following API conventions are approved:

- REST API
- JSON request and response bodies
- `/api/...` URL convention
- No `/api/v1` prefix for this MVP
- Consistent success response envelope containing a `data` field
- Paginated responses include pagination metadata alongside `data`
- Consistent error response structure containing an error code and human-readable message
- Optional field-level validation details for errors
- Appropriate HTTP status codes

### API contract requirements

Create and maintain:

`docs/api-contract.md`

It must document:

- Endpoint paths and HTTP methods
- Authentication requirements and role permissions
- Request parameters and request-body schemas
- Response formats and representative examples
- Error formats and status codes
- Pagination, search, filtering, and sorting conventions
- Shared TypeScript types or schemas where appropriate
- Authentication, refresh, logout, and authorization behavior
- Relevant validation and business-rule expectations

The API contract is a shared agreement between the frontend and backend.

**Neither agent may unilaterally change the API contract.** Propose changes and obtain owner approval before updating the contract and integrating the change.

The contract does not need to contain every implementation detail, but it must be clear enough that frontend and backend can be developed independently without incompatible assumptions.

---

## 11. Testing and Quality

### Backend tests

Use Jest and Supertest.

Test important business rules, including:

- Authentication and authorization
- Registration role restrictions
- Deactivated-account behavior
- Product and category validation
- Product and category permissions
- Order validation and status transitions
- Stock reservation, release, deduction, and restoration
- Manual stock adjustments and audit history
- Concurrency and overselling prevention
- Protection of cost-sensitive fields and dashboard metrics
- Consistent API error handling

### Frontend tests

Use Vitest and React Testing Library.

Test important UI behavior, including:

- Forms and validation feedback
- Protected pages and role-sensitive controls
- Product and category actions
- Order-status interactions
- Dashboard date filters
- Loading, empty, and error states

End-to-end tests are optional for the MVP.

Run lint and build checks when configured. Agents must report only tests and checks they actually ran and their real results. Do not claim that code is tested merely because tests were written.

---

## 12. AI Agent Collaboration Plan

The intended workflow uses one repository with separate frontend and backend directories.

### Antigravity — Frontend

Responsible primarily for:

- React and TypeScript frontend
- Tailwind CSS styling
- React Router navigation
- GSAP animations
- Dashboard and other UI screens
- Reusable components
- Forms, tables, charts, and UI states
- Frontend validation and user feedback
- Frontend tests
- Integration with the approved API contract

### OpenCode — Backend

Responsible primarily for:

- Node.js and Express with TypeScript
- API routes and controllers
- Services and middleware where appropriate
- MongoDB and Mongoose models and database operations
- JWT authentication
- Role-based authorization
- Input validation and error handling
- Inventory and order business rules
- Backend tests

### Project owner

The owner is responsible for:

- Approving requirements and architecture proposals
- Approving the API contract before frontend/backend integration
- Reviewing significant changes
- Deciding unresolved business rules
- Reviewing the database schema proposal before schema implementation
- Keeping control of credentials and sensitive operations
- Resolving conflicts between the agents when necessary

### Collaboration rules

- Both agents must read this brief and `AGENTS.md` before working.
- Both agents must read `docs/api-contract.md` before implementing or integrating API-dependent features, once it exists.
- Antigravity primarily owns `frontend/`.
- OpenCode primarily owns `backend/`.
- Do not have both agents edit the same files simultaneously.
- Shared documentation and root configuration should have one editor at a time.
- The frontend may use mock data while the backend is being developed.
- Mock types and behavior must align with the approved API contract.
- Do not edit the other agent's area without permission.
- Do not silently introduce new features, major dependencies, or different business rules.
- Ask the owner before making significant architectural decisions.

### Intended project structure

The following is the intended top-level structure, not permission to overwrite an existing repository:

```text
StockFlow/
├── AGENTS.md
├── StockFlow_Project_Brief.md
├── docs/
│   └── api-contract.md
├── frontend/
├── backend/
├── .gitignore
└── README.md
```

Inspect the actual working tree before creating, moving, or replacing files.

---

## 13. AI Agent Startup Checklist

Before making implementation changes, an agent must inspect the existing repository and report:

1. Current repository structure and Git working-tree state.
2. Existing frontend and backend setup, package manager, and available scripts.
3. Missing dependencies and required environment-variable **names**, never their secret values.
4. Conflicts between the repository, `AGENTS.md`, and this brief.
5. The smallest useful next implementation step.
6. Any schema or API decisions that require owner approval before implementation.

Run these commands from the project root, adapting only when a command is unavailable:

```bash
pwd
ls -la
git status --short --branch
git rev-parse --show-toplevel
find .. \( -name AGENTS.md -o -name CONTRIBUTING.md -o -name package.json -o -name pnpm-lock.yaml -o -name package-lock.json -o -name yarn.lock \) -print
node --version
npm --version
npm run
```

Do not print `.env` contents or other secret values during inspection.

Do not commit secrets, run destructive database commands, push, deploy, or create paid/production resources without explicit approval.

Do not install or replace major dependencies before inspecting the project and explaining the need.

---

## 14. Decisions Still Requiring Review

The following items are not fully specified and must not be silently invented.

### Database design

- Concrete Mongoose schemas and relationships
- Schema indexes and uniqueness implementation
- Exact stock reservation representation
- Inventory-history schema
- Refresh-token session and token-family storage
- Transaction and concurrency-control implementation

**Required next step:** present a concise database schema proposal for review before implementing the database schema. Keep the proposal practical for an MVP.

### API contract details

- Exact endpoint paths and HTTP methods
- Request and response field names
- Shared TypeScript types and validation schemas
- Detailed error response keys
- Search, filter, and sorting query parameters
- Authentication endpoint details and cookie/CSRF implementation specifics

**Required next step:** draft `docs/api-contract.md` for owner review before frontend/backend integration.

### Other implementation details

- Exact customer/order information fields
- Chart library, if one is needed
- Specific image-upload integration details
- Demo data and recruiter demo credentials
- Deployment platform and production environment

These should not block core development unless a specific feature depends on them. Keep optional portfolio-polish tasks separate from core functionality.

Seed/demo data and recruiter demo credentials have not yet been confirmed. Do not treat them as required for starting the core implementation.

---

## 15. Scope Boundaries

- This is a portfolio MVP, not a production enterprise platform.
- Prioritize a complete, coherent core workflow over excessive abstraction.
- Avoid unrelated features that do not support the inventory, order, or dashboard goals.
- Do not design or change the database schema without first presenting a concise proposal for review.
- Do not change approved business rules or API conventions without owner approval.
- Use sensible implementation defaults for minor decisions that do not alter agreed behavior.
- Do not let optional features, deployment choices, or demo setup delay the core product.
- Keep the code understandable and maintainable so the owner can learn from and explain the implementation during interviews.

---

## 16. Recommended Implementation Sequence

This sequence provides direction without approving unreviewed technical details.

1. Inspect the repository and report its actual state.
2. Reconcile this brief with the existing `AGENTS.md` and project files.
3. Propose the database schema for owner review.
4. Draft and obtain approval for `docs/api-contract.md`.
5. Establish the minimum frontend and backend project setup without overwriting existing work.
6. Implement authentication and authorization according to the approved contract.
7. Implement product and category management.
8. Implement stock adjustments and inventory history.
9. Implement order workflows and stock consistency rules.
10. Implement dashboard metrics and charts.
11. Add remaining tests, validation, documentation, and portfolio polish.
12. Decide deployment after the core application works locally.

The owner may change the sequence. The agents should implement small, reviewable increments and report what they actually completed.

---

## 17. Change Log

- Preserved the original project overview, functional goals, agent responsibilities, owner approval rules, and repository startup checklist.
- Confirmed TypeScript for both frontend and backend.
- Confirmed REST/JSON API communication using `/api/...` without an `/api/v1` prefix.
- Consolidated authentication, token lifecycle, account deactivation, and role-permission requirements.
- Consolidated product, category, image-upload, low-stock, and inventory-history requirements.
- Defined approved order statuses, transitions, stock reservation behavior, cancellation behavior, and historical price snapshots.
- Defined dashboard metrics, currency, date filters, and cost-sensitive access restrictions.
- Added search, filtering, sorting, pagination, and API response conventions.
- Added backend and frontend testing requirements.
- Kept concrete database schemas, detailed endpoint contracts, deployment, and optional demo setup subject to their respective review or later decisions.
