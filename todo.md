# Backend V2 — Remaining Features TODO

## What's Already Built (existing endpoints)

| Route | Method | Endpoint | Status |
|---|---|---|---|
| Search | POST | `/api/search` | Done |
| Voice | POST | `/api/process-voice` | Done |
| Transcribe | POST | `/api/transcribe` | Done |
| TTS | POST | `/api/tts` | Done |
| TTS | GET | `/api/tts/voices` | Done |
| Translate | POST | `/api/translate` | Done |
| Translate | GET | `/api/translate/phrases/:language` | Done |
| Translate | GET | `/api/translate/languages` | Done |
| Chat | POST | `/api/chat` | Done |
| Chat | POST | `/api/chat/start` | Done |
| Chat | POST | `/api/chat/audio` | Done |
| Chat | GET | `/api/chat/history/:sessionId` | Done |
| Chat | DELETE | `/api/chat/:sessionId` | Done |
| Health | GET | `/health` | Done |

---

## What Needs to Be Added

---

### 1. Database Setup (PostgreSQL + Prisma) ✅

- [x] Install `prisma`, `@prisma/client`, `@prisma/adapter-pg`, `pg`
- [x] Run `npx prisma init` — creates `prisma/schema.prisma` and updates `.env` with `DATABASE_URL`
- [x] Define the Prisma schema (all models below)
- [x] Run migration to create tables
- [x] Create `src/config/db.js` — Prisma client singleton (with v7 driver adapter)

#### Prisma Models

```
User
├── id            String    @id @default(uuid())
├── email         String    @unique
├── password      String    (bcrypt hashed)
├── name          String?
├── role          Role      @default(USER)    // USER | ADMIN
├── preferences   Json?     (language, default country, theme, etc.)
├── voucherCode   String?   (the marketer code used at registration, nullable)
├── isVerified    Boolean   @default(false)
├── createdAt     DateTime  @default(now())
├── updatedAt     DateTime  @updatedAt
├── savedLocations  SavedLocation[]
├── searchLogs      SearchLog[]
└── sessions        Session[]

SavedLocation
├── id            String    @id @default(uuid())
├── userId        String    → User
├── label         String    ("Home", "Work", custom)
├── lat           Float
├── lon           Float
├── address       String?
├── country       String    ("QA" | "SA")
├── isDefault     Boolean   @default(false)
├── createdAt     DateTime  @default(now())

SearchLog
├── id            String    @id @default(uuid())
├── userId        String?   → User (nullable for anonymous)
├── query         String
├── platforms     String[]  (["snoonu", "talabat", ...])
├── resultCount   Int
├── country       String    ("QA" | "SA")
├── lat           Float
├── lon           Float
├── createdAt     DateTime  @default(now())

Session (refresh tokens)
├── id            String    @id @default(uuid())
├── userId        String    → User
├── refreshToken  String    @unique
├── userAgent     String?
├── ipAddress     String?
├── expiresAt     DateTime
├── createdAt     DateTime  @default(now())

PasswordReset
├── id            String    @id @default(uuid())
├── userId        String    → User
├── token         String    @unique
├── expiresAt     DateTime
├── used          Boolean   @default(false)
├── createdAt     DateTime  @default(now())

TokenUsage
├── id            String    @id @default(uuid())
├── userId        String    → User
├── service       String    ("search" | "chat" | "tts" | "transcribe" | "translate" | "voice")
├── model         String?   (e.g. "groq-whisper", "groq-llama", "google-tts")
├── inputTokens   Int       @default(0)
├── outputTokens  Int       @default(0)
├── totalTokens   Int       @default(0)
├── cost          Float?    (estimated cost in USD, if applicable)
├── metadata      Json?     (extra context: query length, audio duration, etc.)
├── createdAt     DateTime  @default(now())

Marketer (standalone — not a user account)
├── id            String    @id @default(uuid())
├── name          String    (marketer's name)
├── code          String    @unique (e.g. "AHMED20", "SUMMER2026")
├── isActive      Boolean   @default(true)
├── maxUses       Int?      (null = unlimited)
├── usedCount     Int       @default(0)
├── expiresAt     DateTime? (null = never expires)
├── createdAt     DateTime  @default(now())
├── updatedAt     DateTime  @updatedAt
├── redemptions   VoucherRedemption[]

VoucherRedemption
├── id            String    @id @default(uuid())
├── marketerId    String    → Marketer
├── userId        String    @unique → User (the user who signed up with this code)
├── createdAt     DateTime  @default(now())

+ Add relations to User model:
  ├── tokenUsages        TokenUsage[]
  └── voucherRedemption  VoucherRedemption? (if this user signed up with a code)
```

---

### 2. Middleware to Add

- [ ] **`src/middleware/auth.js`** — JWT authentication middleware
  - Extracts `Bearer <token>` from `Authorization` header
  - Verifies the access token (short-lived, ~15min)
  - Attaches `req.user = { id, email, role }` to the request
  - Throws `401 Unauthorized` if missing/invalid/expired

- [ ] **`src/middleware/requireRole.js`** — Role-based access control
  - Takes allowed roles: `requireRole('ADMIN')`
  - Checks `req.user.role` against allowed roles
  - Throws `403 Forbidden` if not authorized
  - Used on admin-only routes

- [ ] **`src/middleware/rateLimiter.js`** — Rate limiting
  - In-memory or Redis-based rate limiter
  - Configurable per route group (e.g., auth routes get stricter limits)
  - Returns `429 Too Many Requests` when exceeded

- [ ] **`src/middleware/logSearch.js`** — Search analytics logger
  - Runs after a successful `/api/search` response
  - Logs the query, platforms, result count, location, and userId (if authenticated)
  - Writes a `SearchLog` row to the database
  - Non-blocking — doesn't slow down the response

---

### 3. Auth Routes — `src/routes/auth.routes.js`

All mounted under `/api/auth`

| Method | Endpoint | Controller | Middleware | Description |
|---|---|---|---|---|
| POST | `/register` | `register` | rateLimiter, validate | Create new user account (email, password, name, optional voucherCode) |
| POST | `/login` | `login` | rateLimiter, validate | Email/password login → returns access + refresh tokens |
| POST | `/refresh` | `refresh` | validate | Exchange refresh token for new access token |
| POST | `/logout` | `logout` | auth | Invalidate the refresh token (delete session row) |
| POST | `/forgot-password` | `forgotPassword` | rateLimiter, validate | Send password reset email with token link |
| POST | `/reset-password` | `resetPassword` | validate | Verify reset token + set new password |

#### Files to create:
- [ ] `src/routes/auth.routes.js`
- [ ] `src/controllers/auth.controller.js`
- [ ] `src/services/auth.service.js` — handles bcrypt hashing, JWT sign/verify, token rotation, email sending
- [ ] `src/services/email.service.js` — sends transactional emails (password reset). Uses nodemailer or a provider like SendGrid/SES

#### Dependencies to add:
- [ ] `bcrypt` — password hashing
- [ ] `jsonwebtoken` — JWT sign/verify
- [ ] `nodemailer` — email sending (password reset)

---

### 4. User Routes — `src/routes/user.routes.js`

All mounted under `/api/users` — all require `auth` middleware

| Method | Endpoint | Controller | Middleware | Description |
|---|---|---|---|---|
| GET | `/me` | `getProfile` | auth | Get current user profile + preferences |
| PATCH | `/me` | `updateProfile` | auth, validate | Update name, preferences (language, country, theme) |
| PATCH | `/me/password` | `changePassword` | auth, validate | Change password (requires current password) |
| GET | `/me/locations` | `getLocations` | auth | List all saved delivery addresses |
| POST | `/me/locations` | `addLocation` | auth, validate | Save a new delivery address |
| PATCH | `/me/locations/:id` | `updateLocation` | auth, validate | Edit a saved address |
| DELETE | `/me/locations/:id` | `deleteLocation` | auth | Remove a saved address |
| PATCH | `/me/locations/:id/default` | `setDefaultLocation` | auth | Set an address as default |

#### Files to create:
- [ ] `src/routes/user.routes.js`
- [ ] `src/controllers/user.controller.js`
- [ ] `src/services/user.service.js` — profile CRUD, location CRUD, preference management

---

### 5. Admin Routes — `src/routes/admin.routes.js`

All mounted under `/api/admin` — require `auth` + `requireRole('ADMIN')`

| Method | Endpoint | Controller | Middleware | Description |
|---|---|---|---|---|
| GET | `/users` | `listUsers` | auth, admin | Paginated list of all users (with filters) |
| GET | `/users/:id` | `getUser` | auth, admin | Single user detail + their search history |
| PATCH | `/users/:id` | `updateUser` | auth, admin | Edit user role, verify status, etc. |
| DELETE | `/users/:id` | `deleteUser` | auth, admin | Soft-delete or disable a user |
| GET | `/analytics/searches` | `searchAnalytics` | auth, admin | Search query frequency, top queries, trends over time |
| GET | `/analytics/platforms` | `platformAnalytics` | auth, admin | Platform usage breakdown (which platform gets most searches) |
| GET | `/analytics/popular-items` | `popularItems` | auth, admin | Most searched food items |
| GET | `/analytics/activity` | `userActivity` | auth, admin | Active users, session counts, search patterns |
| GET | `/analytics/geo` | `geoAnalytics` | auth, admin | Location-based data (lat/lon clusters, country split) |
| GET | `/analytics/time` | `timeAnalytics` | auth, admin | Peak hours, daily/weekly trends |
| GET | `/analytics/overview` | `overview` | auth, admin | Dashboard summary (total users, searches today, top platform) |
| GET | `/analytics/tokens` | `tokenOverview` | auth, admin | Total token consumption across all users, broken down by service |
| GET | `/analytics/tokens/timeline` | `tokenTimeline` | auth, admin | Token usage over time (daily/weekly/monthly aggregation) |
| GET | `/analytics/tokens/costs` | `tokenCosts` | auth, admin | Estimated cost breakdown by service and model |
| GET | `/users/:id/tokens` | `userTokenUsage` | auth, admin | Single user's full token usage history (paginated, with timestamps) |
| GET | `/users/:id/tokens/summary` | `userTokenSummary` | auth, admin | Single user's aggregated token usage (totals by service, date range filter) |
| GET | `/users/:id/tokens/timeline` | `userTokenTimeline` | auth, admin | Single user's token consumption over time (chart-ready data) |
| POST | `/marketers` | `createMarketer` | auth, admin | Add a new marketer (name + unique code) |
| GET | `/marketers` | `listMarketers` | auth, admin | Paginated list of all marketers with redemption counts |
| GET | `/marketers/:id` | `getMarketer` | auth, admin | Single marketer detail + redemption list |
| PATCH | `/marketers/:id` | `updateMarketer` | auth, admin | Edit marketer (name, code, active status, max uses, expiry) |
| DELETE | `/marketers/:id` | `deleteMarketer` | auth, admin | Deactivate a marketer |
| GET | `/marketers/:id/redemptions` | `marketerRedemptions` | auth, admin | List all users who signed up with this marketer's code (paginated, timestamps) |
| GET | `/analytics/marketers` | `marketerAnalytics` | auth, admin | Overall marketing performance (total signups, top marketers, trends) |
| GET | `/analytics/marketers/:id` | `singleMarketerAnalytics` | auth, admin | Single marketer performance over time (signups per day/week/month) |
| GET | `/export/searches` | `exportSearches` | auth, admin | CSV export of search logs |
| GET | `/export/users` | `exportUsers` | auth, admin | CSV export of user list |
| GET | `/export/tokens` | `exportTokenUsage` | auth, admin | CSV export of token usage logs |
| GET | `/export/marketers` | `exportMarketers` | auth, admin | CSV export of marketers + voucher performance |

#### Files to create:
- [ ] `src/routes/admin.routes.js`
- [ ] `src/controllers/admin.controller.js`
- [ ] `src/services/admin.service.js` — user management queries
- [ ] `src/services/analytics.service.js` — all analytics aggregation queries (SQL via Prisma)
- [ ] `src/services/export.service.js` — CSV/PDF generation

#### Dependencies to add:
- [ ] `csv-stringify` or similar — for CSV export
- [ ] `pdfkit` or similar — for PDF export (if needed)

---

### 6. Token Usage Tracking (Admin Visibility)

Every API call that consumes external AI tokens should be tracked so the admin can monitor usage per user over time.

#### How it works:
- A `trackTokenUsage` utility is called inside each service (search, chat, TTS, transcribe, translate, voice) after a successful API call
- It writes a `TokenUsage` row with: userId, service name, model used, input/output/total tokens, estimated cost, and timestamp
- For anonymous users, `userId` is null (same pattern as `SearchLog`)

#### Middleware / Utility:
- [ ] **`src/utils/tokenTracker.js`** — helper function to log token usage to DB
  - `trackTokenUsage({ userId, service, model, inputTokens, outputTokens, totalTokens, cost, metadata })`
  - Non-blocking — fire-and-forget, doesn't slow down the response
  - Gracefully handles DB errors (logs warning, doesn't crash)

#### Service updates (add token tracking calls):
- [ ] `src/services/search.service.js` — track tokens after GROQ keyword extraction
- [ ] `src/services/chat.service.js` — track tokens after each chat completion
- [ ] `src/services/tts.service.js` — track usage after TTS synthesis (character count as proxy)
- [ ] `src/services/transcription.service.js` — track tokens after audio transcription
- [ ] `src/services/translation.service.js` — track tokens after translation calls
- [ ] `src/services/voice.service.js` — track tokens after voice processing pipeline

#### Admin service:
- [ ] **`src/services/tokenUsage.service.js`** — query logic for all token analytics
  - `getTokenOverview()` — totals by service across all users
  - `getTokenTimeline(granularity, dateRange)` — time-series aggregation (daily/weekly/monthly)
  - `getTokenCosts(dateRange)` — cost breakdown by service and model
  - `getUserTokenUsage(userId, pagination)` — paginated history for a single user
  - `getUserTokenSummary(userId, dateRange)` — aggregated totals per service for a user
  - `getUserTokenTimeline(userId, granularity, dateRange)` — per-user time-series data
  - All queries support date range filters (`from`, `to` query params)

#### Admin endpoints (see Section 5 route table):
- `GET /api/admin/analytics/tokens` — global token overview
- `GET /api/admin/analytics/tokens/timeline?granularity=daily&from=...&to=...`
- `GET /api/admin/analytics/tokens/costs?from=...&to=...`
- `GET /api/admin/users/:id/tokens?page=1&limit=50`
- `GET /api/admin/users/:id/tokens/summary?from=...&to=...`
- `GET /api/admin/users/:id/tokens/timeline?granularity=weekly`
- `GET /api/admin/export/tokens?from=...&to=...` — CSV export

---

### 7. Marketing Team & Voucher Codes

Each marketer is a simple record with a name and a unique code (not a user account). Users can enter a code during registration. The admin manages marketers and sees performance stats.

#### Registration flow update:
- [ ] Update `POST /api/auth/register` to accept an optional `voucherCode` field
  - If provided, validate the code exists, is active, not expired, and hasn't hit max uses
  - If valid: create the user, increment `Marketer.usedCount`, write a `VoucherRedemption` row, store `voucherCode` on the User
  - If invalid/expired: return `400` with a clear error message
  - If not provided: proceed with normal registration (no code attached)

#### Files to create:
- [ ] **`src/services/marketer.service.js`** — marketer CRUD
  - `createMarketer(data)` — create a marketer (name + code)
  - `listMarketers(pagination, filters)` — with redemption count per marketer
  - `getMarketer(id)` — detail with redemptions list
  - `updateMarketer(id, data)` — edit name, code, active status, max uses, expiry
  - `deactivateMarketer(id)` — set isActive = false
  - `getRedemptions(marketerId, pagination)` — paginated list of users who used the code

- [ ] **`src/services/marketerAnalytics.service.js`** — marketing analytics queries
  - `getMarketerOverview()` — total signups via codes, top performing marketers, trends
  - `getSingleMarketerAnalytics(marketerId, granularity, dateRange)` — signups over time
  - All queries support date range filters (`from`, `to`)

- [ ] **`src/utils/voucherValidator.js`** — reusable validation logic
  - `validateVoucher(code)` — checks marketer exists, is active, not expired, hasn't hit max uses
  - Returns `{ valid, marketer, error }` object
  - Used by auth service during registration

#### Admin endpoints (see Section 5 route table):
- `POST /api/admin/marketers` — create marketer (name + code)
- `GET /api/admin/marketers` — list all marketers
- `GET /api/admin/marketers/:id` — single marketer detail
- `PATCH /api/admin/marketers/:id` — update marketer
- `DELETE /api/admin/marketers/:id` — deactivate marketer
- `GET /api/admin/marketers/:id/redemptions` — who signed up with this code
- `GET /api/admin/analytics/marketers` — overall marketing performance
- `GET /api/admin/analytics/marketers/:id` — single marketer performance
- `GET /api/admin/export/marketers` — CSV export

---

### 8. Search Enhancement (analytics logging)

The existing search endpoint needs a small addition:

- [ ] Update `src/controllers/search.controller.js` — after responding, log the search to DB
- [ ] The `logSearch` middleware (or inline in controller) writes a `SearchLog` row
- [ ] If user is authenticated (`req.user` exists), attach their userId

---

### 9. Saudi Arabia Market Support

The contract specifies Talabat for Saudi Arabia:

- [ ] Create `src/platforms/talabat-sa.js` — Talabat adapter configured for Saudi Arabia
  - Different `country_id`, coordinates, and possibly different API endpoints
  - Reuses the same parsing logic from `talabat.js`
- [ ] Update `src/services/search.service.js` — accept a `country` param (`QA` | `SA`)
  - QA: snoonu, rafeeq, talabat (existing)
  - SA: talabat-sa only
- [ ] Update `src/controllers/search.controller.js` — pass `country` from request body

---

### 10. Update Route Aggregator

- [ ] Mount new routes in `src/routes/index.js`:
  ```js
  router.use('/auth', authRoutes);
  router.use('/users', userRoutes);
  router.use('/admin', adminRoutes);
  ```

---

### 11. Config Updates

- [ ] Add to `src/config/index.js`:
  ```
  jwt: {
    accessSecret, accessExpiry ('15m'),
    refreshSecret, refreshExpiry ('7d'),
  },
  email: {
    host, port, user, pass, from
  },
  database: {
    url (DATABASE_URL)
  }
  ```
- [ ] Update `.env.example` with new vars:
  ```
  DATABASE_URL=postgresql://user:pass@localhost:5432/foodfetch
  JWT_ACCESS_SECRET=
  JWT_REFRESH_SECRET=
  EMAIL_HOST=
  EMAIL_PORT=
  EMAIL_USER=
  EMAIL_PASS=
  EMAIL_FROM=
  ```

---

## Summary — Files to Create

| Category | Files |
|---|---|
| Database | `prisma/schema.prisma`, `src/config/db.js` |
| Middleware | `auth.js`, `requireRole.js`, `rateLimiter.js`, `logSearch.js` |
| Auth | `auth.routes.js`, `auth.controller.js`, `auth.service.js`, `email.service.js` |
| Users | `user.routes.js`, `user.controller.js`, `user.service.js` |
| Admin | `admin.routes.js`, `admin.controller.js`, `admin.service.js`, `analytics.service.js`, `export.service.js` |
| Token Tracking | `src/utils/tokenTracker.js`, `src/services/tokenUsage.service.js` |
| Marketing | `marketer.service.js`, `marketerAnalytics.service.js`, `src/utils/voucherValidator.js` |
| Platforms | `talabat-sa.js` |
| Updates | `routes/index.js`, `config/index.js`, `.env.example`, `search.controller.js`, `search.service.js`, `chat.service.js`, `tts.service.js`, `transcription.service.js`, `translation.service.js`, `voice.service.js`, `auth.service.js` |

**Total new files: ~23**
**Updated files: ~12**

---

## New Dependencies

| Package | Purpose |
|---|---|
| `prisma` | DB migrations & schema management (dev dep) |
| `@prisma/client` | Database ORM |
| `bcrypt` | Password hashing |
| `jsonwebtoken` | JWT tokens |
| `nodemailer` | Email sending |
| `csv-stringify` | CSV export |
