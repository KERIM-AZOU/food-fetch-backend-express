# Food Finder API v2

Base URL: `http://localhost:5006`

All API routes are prefixed with `/api`. Authentication uses a single JWT token (7-day expiry) sent as `Authorization: Bearer <token>`.

---

## Authentication

### Register

```
POST /api/auth/register
```

| Field | Type | Required | Description |
|---|---|---|---|
| email | string | Yes | User email |
| password | string | Yes | Password |
| name | string | No | Display name |
| voucherCode | string | No | Marketer voucher code (e.g. "AHMED20") |

**Response (201):**
```json
{
  "user": {
    "id": "...",
    "email": "user@example.com",
    "name": "John",
    "role": "USER",
    "createdAt": "2026-02-13T..."
  },
  "token": "eyJhbG..."
}
```

**Errors:** `409` email taken, `400` missing fields or invalid voucher

---

### Login

```
POST /api/auth/login
```

| Field | Type | Required |
|---|---|---|
| email | string | Yes |
| password | string | Yes |

**Response (200):**
```json
{
  "user": { "id": "...", "email": "...", "name": "...", "role": "USER" },
  "token": "eyJhbG..."
}
```

**Errors:** `401` invalid credentials

---

### Logout

```
POST /api/auth/logout
Authorization: Bearer <token>
```

Invalidates the current token. No body required.

**Response (200):** `{ "message": "Logged out" }`

---

### Logout All Sessions

```
POST /api/auth/logout-all
Authorization: Bearer <token>
```

Invalidates all tokens for the user (all devices).

**Response (200):** `{ "message": "All sessions logged out" }`

---

### Forgot Password

```
POST /api/auth/forgot-password
```

| Field | Type | Required |
|---|---|---|
| email | string | Yes |

Always returns 200 (doesn't leak whether email exists).

**Response (200):** `{ "message": "If that email exists, a reset link has been sent" }`

---

### Reset Password

```
POST /api/auth/reset-password
```

| Field | Type | Required |
|---|---|---|
| token | string | Yes | Reset token from email |
| newPassword | string | Yes |

**Response (200):** `{ "message": "Password reset successful" }`

**Errors:** `400` invalid/expired token

---

## User Profile

All routes require `Authorization: Bearer <token>`.

### Get Profile

```
GET /api/users/me
```

**Response (200):**
```json
{
  "_id": "...",
  "email": "user@example.com",
  "name": "John",
  "role": "USER",
  "preferences": { "language": "en", "country": "QA", "theme": "light" },
  "voucherCode": null,
  "isVerified": false,
  "createdAt": "...",
  "updatedAt": "..."
}
```

---

### Update Profile

```
PATCH /api/users/me
```

| Field | Type | Description |
|---|---|---|
| name | string | Display name |
| preferences | object | `{ language, country, theme, ... }` |

Only `name` and `preferences` can be updated. Role and email are ignored.

---

### Change Password

```
PATCH /api/users/me/password
```

| Field | Type | Required |
|---|---|---|
| currentPassword | string | Yes |
| newPassword | string | Yes |

Invalidates all existing sessions after password change.

**Errors:** `401` wrong current password

---

## Saved Locations

All routes require `Authorization: Bearer <token>`.

### List Locations

```
GET /api/users/me/locations
```

**Response (200):** Array of location objects, sorted by default first.

---

### Add Location

```
POST /api/users/me/locations
```

| Field | Type | Required | Description |
|---|---|---|---|
| label | string | Yes | "Home", "Work", etc. |
| lat | number | Yes | Latitude |
| lon | number | Yes | Longitude |
| country | string | Yes | "QA" or "SA" |
| address | string | No | Street address |
| isDefault | boolean | No | Set as default (unsets previous default) |

**Response (201):** Created location object.

---

### Update Location

```
PATCH /api/users/me/locations/:id
```

Accepts: `label`, `lat`, `lon`, `address`, `country`.

---

### Delete Location

```
DELETE /api/users/me/locations/:id
```

**Response (200):** `{ "message": "Location deleted" }`

---

### Set Default Location

```
PATCH /api/users/me/locations/:id/default
```

Sets this location as the default. Unsets any previous default.

---

## Search

### Search Food Products

```
POST /api/search
```

| Field | Type | Default | Description |
|---|---|---|---|
| term | string | (required) | Search query (e.g. "pizza", "burger") |
| lat | number | 25.2855 | Latitude |
| lon | number | 51.5314 | Longitude |
| country | string | "QA" | "QA" (Qatar) or "SA" (Saudi Arabia) |
| platforms | string[] | auto | Platform list. QA: `["snoonu","rafeeq","talabat"]`, SA: `["talabat-sa"]` |
| sort | string | "price" | Sort by: "price", "rating", "time" |
| page | number | 1 | Page number |
| price_min | number | - | Min price filter |
| price_max | number | - | Max price filter |
| time_min | number | - | Min delivery time (minutes) |
| time_max | number | - | Max delivery time (minutes) |
| restaurant_filter | string | "" | Filter by restaurant name |

**Response (200):**
```json
{
  "products": [
    {
      "product_name": "Margherita Pizza",
      "product_price": 35,
      "product_image": "https://...",
      "product_url": "https://...",
      "restaurant_name": "Pizza Hut",
      "restaurant_image": "https://...",
      "restaurant_rating": 4.5,
      "restaurant_eta": "30 mins",
      "eta_minutes": 30,
      "source": "Talabat"
    }
  ],
  "pagination": { "page": 1, "perPage": 12, "total": 50, "pages": 5 },
  "all_restaurants": ["Pizza Hut", "Dominos", ...]
}
```

---

## Chat

### Start Chat Session

```
POST /api/chat/start
```

| Field | Type | Default | Description |
|---|---|---|---|
| sessionId | string | auto | Custom session ID |
| language | string | "en" | Chat language code |
| generateAudio | boolean | true | Return audio greeting |

**Response (200):**
```json
{
  "sessionId": "abc123",
  "greeting": "Hey there! What's on your mind?",
  "audio": "base64...",
  "contentType": "audio/mpeg"
}
```

---

### Text Chat

```
POST /api/chat
```

| Field | Type | Default | Description |
|---|---|---|---|
| message | string | (required) | User message |
| sessionId | string | "default" | Session ID |
| language | string | "en" | Language code |
| generateAudio | boolean | true | Return audio response |

**Response (200):**
```json
{
  "response": "Great choice! Let me find some pizza for you.",
  "foodMentioned": true,
  "foodItems": ["pizza"],
  "shouldSearch": true,
  "shouldStop": false,
  "audio": "base64...",
  "contentType": "audio/mpeg",
  "searchResults": { ... }
}
```

---

### Audio Chat

```
POST /api/chat/audio
```

| Field | Type | Default | Description |
|---|---|---|---|
| audio | string | (required) | Base64 audio data |
| mimeType | string | "audio/webm" | Audio MIME type |
| sessionId | string | "default" | Session ID |

---

### Get Chat History

```
GET /api/chat/history/:sessionId
```

---

### Clear Chat

```
DELETE /api/chat/:sessionId
```

**Response (200):** `{ "success": true, "message": "Conversation cleared" }`

---

## Transcription

```
POST /api/transcribe
```

| Field | Type | Default | Description |
|---|---|---|---|
| audio | string | (required) | Base64 audio data |
| mimeType | string | "audio/webm" | Audio MIME type |

**Response (200):**
```json
{
  "text": "I want pizza",
  "language": "en"
}
```

---

## Text-to-Speech

### Synthesize

```
POST /api/tts
```

| Field | Type | Description |
|---|---|---|
| text | string | Text to synthesize |
| voiceId | string | Optional ElevenLabs voice ID |

**Response (200):**
```json
{
  "audio": "base64...",
  "contentType": "audio/mpeg"
}
```

### List Voices

```
GET /api/tts/voices
```

**Response (200):** Array of `{ id, name, category }`.

---

## Translation

### Translate Text

```
POST /api/translate
```

| Field | Type | Default | Description |
|---|---|---|---|
| text | string | - | Text to translate |
| language | string | "en" | Target language code |
| type | string | - | Predefined phrase type (alternative to text) |

**Response (200):**
```json
{
  "translated": "...",
  "language": "ar"
}
```

### Get Phrases

```
GET /api/translate/phrases/:language
```

Returns predefined translated phrases for a language.

### List Languages

```
GET /api/translate/languages
```

**Response (200):**
```json
{
  "languages": ["en", "ar", "fr", "es", "de", "zh", "hi", "pt", "ru", "ja", "ko", "it", "tr"]
}
```

---

## Voice Processing

```
POST /api/process-voice
```

| Field | Type | Default | Description |
|---|---|---|---|
| text | string | (required) | Transcribed text (or raw text) |
| language | string | "en" | Language code |
| lat | number | 25.2855 | Latitude |
| lon | number | 51.5314 | Longitude |
| validate | boolean | false | Validate food keywords |
| useAI | boolean | true | Use AI extraction |

Processes voice input: extracts food keywords, translates if needed, and searches platforms.

---

## Admin Routes

All admin routes require `Authorization: Bearer <token>` with `role: "ADMIN"`.

Regular users get `403 Forbidden`.

### User Management

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/users` | Paginated user list |
| GET | `/api/admin/users/:id` | Single user detail |
| PATCH | `/api/admin/users/:id` | Update user (role, isVerified, name) |
| DELETE | `/api/admin/users/:id` | Delete user |

**Query params for GET /admin/users:**
- `page` (default 1), `limit` (default 20)
- `role` — filter by "USER" or "ADMIN"
- `search` — search by email or name

**Response:**
```json
{
  "users": [...],
  "total": 150,
  "page": 1,
  "limit": 20,
  "pages": 8
}
```

---

### Analytics

All analytics endpoints support `?from=2026-01-01&to=2026-02-01` date filters.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/analytics/overview` | Dashboard summary (total users, searches today, top platform) |
| GET | `/api/admin/analytics/searches` | Top queries, search frequency |
| GET | `/api/admin/analytics/platforms` | Platform usage breakdown |
| GET | `/api/admin/analytics/popular-items` | Most searched food items |
| GET | `/api/admin/analytics/activity` | Active users, session counts |
| GET | `/api/admin/analytics/geo` | Country split |
| GET | `/api/admin/analytics/time` | Peak hours, daily/weekly/monthly trends |

**Time analytics** supports `?granularity=hourly|daily|weekly|monthly`.

---

### Token Usage Analytics

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/analytics/tokens` | Total token consumption by service |
| GET | `/api/admin/analytics/tokens/timeline` | Token usage over time |
| GET | `/api/admin/analytics/tokens/costs` | Cost breakdown by service/model |
| GET | `/api/admin/users/:id/tokens` | User's token usage history (paginated) |
| GET | `/api/admin/users/:id/tokens/summary` | User's aggregated token totals |
| GET | `/api/admin/users/:id/tokens/timeline` | User's token usage over time |

**Query params:** `granularity`, `from`, `to`, `page`, `limit`

---

### Marketer Management

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/admin/marketers` | Create marketer (name + code) |
| GET | `/api/admin/marketers` | List all marketers |
| GET | `/api/admin/marketers/:id` | Single marketer detail |
| PATCH | `/api/admin/marketers/:id` | Update marketer |
| DELETE | `/api/admin/marketers/:id` | Deactivate marketer |
| GET | `/api/admin/marketers/:id/redemptions` | Users who used this code |

**Create marketer body:**
```json
{
  "name": "Ahmed",
  "code": "AHMED20",
  "maxUses": 100,
  "expiresAt": "2026-12-31T00:00:00.000Z"
}
```

---

### Marketer Analytics

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/analytics/marketers` | Overall marketing performance |
| GET | `/api/admin/analytics/marketers/:id` | Single marketer performance over time |

---

### CSV Exports

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/export/searches` | Search logs CSV |
| GET | `/api/admin/export/users` | User list CSV |
| GET | `/api/admin/export/tokens` | Token usage CSV |
| GET | `/api/admin/export/marketers` | Marketers CSV |

All export endpoints support `?from=...&to=...` date filters. Response is `text/csv` with `Content-Disposition` header.

---

## Error Format

All errors return JSON:

```json
{
  "error": "Error message here"
}
```

Common status codes:
- `400` — Bad request (missing fields, validation error)
- `401` — Unauthorized (missing/invalid/expired token)
- `403` — Forbidden (insufficient role)
- `404` — Not found
- `409` — Conflict (duplicate email, duplicate marketer code)
- `429` — Too many requests (rate limited)
- `500` — Internal server error

---

## Health Check

```
GET /health
```

**Response (200):**
```json
{ "status": "healthy", "service": "food-finder-v2" }
```
