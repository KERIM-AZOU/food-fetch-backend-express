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

### 1. Database Setup (PostgreSQL + Prisma)

- [ ] Install `prisma` and `@prisma/client`
- [ ] Run `npx prisma init` — creates `prisma/schema.prisma` and updates `.env` with `DATABASE_URL`
- [ ] Define the Prisma schema (all models below)
- [ ] Run `npx prisma migrate dev` to create tables
- [ ] Create `src/config/db.js` — Prisma client singleton

#### Prisma Models

```
User
├── id            String    @id @default(uuid())
├── email         String    @unique
├── password      String    (bcrypt hashed)
├── name          String?
├── role          Role      @default(USER)    // USER | ADMIN
├── preferences   Json?     (language, default country, theme, etc.)
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
| POST | `/register` | `register` | rateLimiter, validate | Create new user account (email, password, name) |
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
| GET | `/export/searches` | `exportSearches` | auth, admin | CSV export of search logs |
| GET | `/export/users` | `exportUsers` | auth, admin | CSV export of user list |

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

### 6. Search Enhancement (analytics logging)

The existing search endpoint needs a small addition:

- [ ] Update `src/controllers/search.controller.js` — after responding, log the search to DB
- [ ] The `logSearch` middleware (or inline in controller) writes a `SearchLog` row
- [ ] If user is authenticated (`req.user` exists), attach their userId

---

### 7. Saudi Arabia Market Support

The contract specifies Talabat for Saudi Arabia:

- [ ] Create `src/platforms/talabat-sa.js` — Talabat adapter configured for Saudi Arabia
  - Different `country_id`, coordinates, and possibly different API endpoints
  - Reuses the same parsing logic from `talabat.js`
- [ ] Update `src/services/search.service.js` — accept a `country` param (`QA` | `SA`)
  - QA: snoonu, rafeeq, talabat (existing)
  - SA: talabat-sa only
- [ ] Update `src/controllers/search.controller.js` — pass `country` from request body

---

### 8. Update Route Aggregator

- [ ] Mount new routes in `src/routes/index.js`:
  ```js
  router.use('/auth', authRoutes);
  router.use('/users', userRoutes);
  router.use('/admin', adminRoutes);
  ```

---

### 9. Config Updates

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
| Platforms | `talabat-sa.js` |
| Updates | `routes/index.js`, `config/index.js`, `.env.example`, `search.controller.js`, `search.service.js` |

**Total new files: ~18**
**Updated files: ~5**

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
