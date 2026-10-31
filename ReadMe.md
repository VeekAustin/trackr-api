# Trackr API

[![CI](https://github.com/VeekAustin/trackr-api/actions/workflows/ci.yml/badge.svg)](https://github.com/VeekAustin/trackr-api/actions/workflows/ci.yml)

The backend for **Trackr**, a personal progress log where users create their own categories ("tracks") and log dated entries under them. Built as a full-stack capstone project to practice production-shaped backend patterns: auth, ownership-scoped data, cursor pagination, caching, rate limiting, password reset by email, centralized error handling, and automated testing in CI.

Live API: `https://trackr-api-pr90.onrender.com`
Frontend repo: [trackr-web](https://github.com/VeekAustin/trackr-web)

## Features

- **Auth**: signup and login with hashed passwords (bcrypt) and JWT sessions that last 7 days
- **Password reset by email**: single-use, hashed, 30-minute tokens, sent through Brevo's HTTPS API
- **Dynamic tracks**: users define their own categories (name + color) instead of a fixed list
- **Entries**: dated, titled log entries, backfillable to past dates, returned newest date first with cursor-based pagination
- **Activity stats**: one endpoint returns totals, current and longest streak, a 90-day heatmap, and weekly and monthly breakdowns per track. The client sends its own calendar day, so streaks follow the user's timezone
- **Ownership enforcement**: every read, write and delete is scoped to the caller, and an entry can only be added to one of the caller's own tracks
- **Cascade delete**: deleting a track removes its entries too
- **Redis caching**: `GET /tracks` is cached per user, and the API keeps working if Redis is unavailable
- **Rate limiting**: per-IP limits on signup, login and the password-reset routes
- **Role-aware tokens**: the JWT payload carries a `role` claim, and a `restrictTo` middleware is ready for future admin routes
- **Centralized error handling**: a custom `AppError` class and global error middleware, plus structured JSON request logging
- **Tested**: unit and integration tests with Vitest, Supertest and an in-memory MongoDB, run on every push by GitHub Actions

## Tech stack

| Layer         | Choice                                   |
| ------------- | ---------------------------------------- |
| Runtime       | Node.js                                  |
| Framework     | Express 5                                |
| Language      | TypeScript                               |
| Database      | MongoDB Atlas                            |
| ODM           | Mongoose                                 |
| Cache         | Redis (Render Key Value) via ioredis     |
| Auth          | bcryptjs, jsonwebtoken                   |
| Email         | Brevo transactional email API            |
| Rate limiting | express-rate-limit                       |
| Dev runner    | tsx                                      |
| Testing       | Vitest, Supertest, mongodb-memory-server |
| CI            | GitHub Actions                           |
| Hosting       | Render                                   |

## Project structure

```
.github/workflows/  # CI: build and test on push and pull requests
src/
  config/           # DB connection
  controllers/      # route handlers
  middleware/       # auth, roles, rate limiting, error handling, request logging
  models/           # Mongoose schemas
  routes/           # Express routers
  test/             # integration tests + test DB setup
  types/            # Express type extensions
  utils/            # hashing, JWT, email, cache, stats, AppError, controller helpers
  app.ts            # Express app (no listening)
  server.ts         # entry point: connects DB, starts server
```

## Getting started

```bash
git clone https://github.com/VeekAustin/trackr-api.git
cd trackr-api
npm install
```

Create a `.env` file:

```
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_random_secret
CLIENT_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3000
BREVO_API_KEY=
EMAIL_FROM=
REDIS_URL=
```

| Variable        | Purpose                                                              |
| --------------- | -------------------------------------------------------------------- |
| `MONGO_URI`     | MongoDB connection string (include the database name)                |
| `JWT_SECRET`    | Secret used to sign tokens                                           |
| `CLIENT_URL`    | Frontend origin allowed by CORS                                      |
| `FRONTEND_URL`  | Base URL used to build the link in password reset emails             |
| `BREVO_API_KEY` | Brevo API key. Optional in development                               |
| `EMAIL_FROM`    | Verified sender address in Brevo. Optional in development            |
| `REDIS_URL`     | Redis connection URL. Optional: caching is off when it is empty      |

If `BREVO_API_KEY` and `EMAIL_FROM` are empty outside production, the reset link is printed to the server console instead of being emailed.

Run it:

```bash
npm run dev     # dev server with auto-reload
npm run build   # type-check and compile to dist/
npm start       # run the compiled build
npm test        # run the test suite
```

## API reference

All routes are prefixed with `/api`. Errors return a JSON body with a message and an appropriate status code.

### Auth

| Method | Route                   | Body                        | Notes                                                                                  |
| ------ | ----------------------- | --------------------------- | -------------------------------------------------------------------------------------- |
| POST   | `/auth/signup`          | `{ name, email, password }` | Returns `{ message, user }`. No token: the user logs in next                           |
| POST   | `/auth/login`           | `{ email, password }`       | Returns `{ message, token, user }`                                                     |
| POST   | `/auth/forgot-password` | `{ email }`                 | Always replies 200 with the same message, whether or not the account exists            |
| POST   | `/auth/reset-password`  | `{ token, password }`       | Token comes from the emailed link. Single use, expires after 30 minutes. Password: at least 8 characters |

### Tracks (requires `Authorization: Bearer <token>`)

| Method | Route         | Body              | Notes                                                                 |
| ------ | ------------- | ----------------- | --------------------------------------------------------------------- |
| GET    | `/tracks`     | none              | Returns the caller's tracks. Cached for 60 seconds (`X-Cache: HIT` or `MISS`) |
| POST   | `/tracks`     | `{ name, color }` | Name must be unique per user                                          |
| DELETE | `/tracks/:id` | none              | Cascades to the track's entries                                       |

### Entries (requires `Authorization: Bearer <token>`)

| Method | Route                | Body                             | Notes                                                                                                                                       |
| ------ | -------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/entries`           | none                             | Newest date first, cursor-paginated. Query: `limit` (default 10, max 50) and `cursor`. Returns `{ data, nextCursor, hasNextPage }`. Pass `nextCursor` back as `cursor` for the next page |
| GET    | `/entries/stats`     | none                             | Query: `today=YYYY-MM-DD` (optional, defaults to the server's UTC date). Returns `{ total, activeDays, currentStreak, longestStreak, heatmap, weeks, months }` |
| POST   | `/entries`           | `{ track, title, notes?, date }` | `date` as `YYYY-MM-DD`. `track` must be one of the caller's tracks (400 malformed id, 404 not found, 403 not yours)                         |
| DELETE | `/entries/:id`       | none                             | Must belong to the caller                                                                                                                   |

In the stats response, `heatmap` lists the days in the last 90 days that have entries. `weeks` (8, Monday to Sunday) and `months` (6) list entries per track, newest first.

### Rate limits

Limits are per IP address with a 15-minute window. Going over returns `429` with `{ "message": "Too many attempts. Please try again in 15 minutes." }`.

| Routes                                          | Limit |
| ----------------------------------------------- | ----- |
| `/auth/forgot-password`, `/auth/reset-password` | 5     |
| `/auth/signup`, `/auth/login`                   | 20    |

## Design decisions

- **Shared controller helpers.** Ownership checks, not-found lookups and duplicate-key detection live in `utils/controllerHelpers.ts` rather than being repeated per controller, so every resource-scoped route enforces the same rule.
- **Signup does not issue a token.** Login is the only place a token is created, so there is one path to a session.
- **Password reset avoids account enumeration.** `forgot-password` gives the same reply for known and unknown emails. Only a SHA-256 hash of the reset token is stored, the token can be used once, and it expires after 30 minutes.
- **Email over HTTPS, not SMTP.** Render's free tier blocks outbound SMTP ports, so reset emails go through Brevo's HTTP API.
- **Cursor pagination follows the order users see.** Entries can be backfilled to past dates, so the list sorts by entry date with the id as a tiebreaker, and the cursor encodes both. Paging stays stable when new entries are added.
- **Statistics are plain functions.** Streaks, the heatmap window and the week and month breakdowns are computed in `utils/stats.ts` from one aggregation of per-day, per-track counts, so the logic is unit-tested without a database. The client sends its calendar day so a streak does not break because of the server's timezone.
- **Cache-aside with a TTL.** `GET /tracks` is read from Redis first and falls back to MongoDB. Writes delete the user's key, and a 60-second TTL bounds any staleness. A cache failure never fails a request.
- **HTTP caching headers.** Auth responses are `no-store`. Per-user data is `private, no-cache`, so browsers revalidate with ETags and shared caches never store it.

## Testing

```bash
npm test
```

Covers:

- Hashing and token utilities
- Date, streak, week and month logic for the stats endpoint
- Auth flow: signup, duplicate email rejection, login, wrong password
- Password reset: unknown email, valid token used once, old password rejected, invalid token
- Track and entry CRUD, cross-user data isolation, cascade delete, ownership checks on delete
- Entry creation on another user's track, a missing track, and malformed ids
- Cursor pagination across pages, including backfilled dates
- Stats endpoint results for one user's entries
- Caching: second read served from cache, invalidation on write, isolation between users, and working with the cache down

Integration tests run against an in-memory MongoDB instance (`mongodb-memory-server`), isolated from the real Atlas database. Rate limiting is switched off when `NODE_ENV` is `test`, and caching is off unless a test injects a cache.

## Deployment

Hosted on Render. The build runs `npm install && npm run build`, and the service starts with `npm start`. Environment variables (`MONGO_URI`, `JWT_SECRET`, `CLIENT_URL`, `FRONTEND_URL`, `BREVO_API_KEY`, `EMAIL_FROM`, `REDIS_URL`) are set in Render's dashboard and never committed to the repo. The cache is a free Render Key Value instance in the same region as the API.

## Known limitations

- **Cold starts.** The free Render tier spins down after inactivity, so the first request can take 30 to 60 seconds.
- **In-memory state.** Rate-limit counters live in the server process and reset on restart. The free Key Value instance also loses its data on restart, which is acceptable for a cache.
- **Email deliverability.** Reset emails are sent from a single verified sender address without a custom domain, so they may land in spam.
- **Only one route is cached.** Caching paginated entries would need a versioned-key scheme to invalidate every page on write.