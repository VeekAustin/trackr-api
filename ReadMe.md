# Trackr API

[![CI](https://github.com/VeekAustin/trackr-api/actions/workflows/ci.yml/badge.svg)](https://github.com/VeekAustin/trackr-api/actions/workflows/ci.yml)

The backend for **Trackr**, a personal progress log where users create their own categories ("tracks") and log dated entries under them. Built as a full-stack capstone project to practice production-shaped backend patterns: auth, ownership-scoped data, cascading deletes, centralized error handling, password reset by email, rate limiting, and automated testing.

Live API: `https://trackr-api-pr90.onrender.com`
Frontend repo: [trackr-web](https://github.com/VeekAustin/trackr-web)

## Features

- **Auth**: signup and login with hashed passwords (bcrypt) and JWT sessions that last 7 days
- **Password reset by email**: single-use, hashed, 30-minute tokens, sent through Brevo's HTTPS API
- **Dynamic tracks**: users define their own categories (name + color) instead of a fixed list
- **Entries**: dated, titled log entries scoped to a track and a user, returned with cursor-based pagination
- **Ownership enforcement**: every write or delete checks the resource belongs to the requesting user
- **Cascade delete**: deleting a track removes its entries too
- **Rate limiting**: per-IP limits on signup, login and the password-reset routes
- **Role-aware tokens**: the JWT payload carries a `role` claim, and a `restrictTo` middleware is ready for future admin routes
- **Centralized error handling**: a custom `AppError` class and global error middleware instead of repeated try/catch boilerplate
- **Tested**: unit tests (hashing, JWT) and integration tests (auth flow, password reset, CRUD, ownership, cascade delete) with Vitest, Supertest and an in-memory MongoDB, run on every push by GitHub Actions

## Tech stack

| Layer         | Choice                                   |
| ------------- | ---------------------------------------- |
| Runtime       | Node.js                                  |
| Framework     | Express 5                                |
| Language      | TypeScript                               |
| Database      | MongoDB Atlas                            |
| ODM           | Mongoose                                 |
| Auth          | bcryptjs, jsonwebtoken                   |
| Email         | Brevo transactional email API            |
| Rate limiting | express-rate-limit                       |
| Dev runner    | tsx                                      |
| Testing       | Vitest, Supertest, mongodb-memory-server |
| CI            | GitHub Actions                           |
| Hosting       | Render                                   |

## Project structure

```
.github/workflows/  # CI: runs the test suite on push and pull requests
src/
  config/           # DB connection
  controllers/      # route handlers
  middleware/       # auth, roles, rate limiting, error handling
  models/           # Mongoose schemas
  routes/           # Express routers
  test/             # integration tests + test DB setup
  types/            # Express type extensions
  utils/            # hashing, JWT, email, AppError, controller helpers
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
```

| Variable        | Purpose                                                                  |
| --------------- | ------------------------------------------------------------------------ |
| `MONGO_URI`     | MongoDB connection string (include the database name)                    |
| `JWT_SECRET`    | Secret used to sign tokens                                               |
| `CLIENT_URL`    | Frontend origin allowed by CORS                                          |
| `FRONTEND_URL`  | Base URL used to build the link in password reset emails                 |
| `BREVO_API_KEY` | Brevo API key. Optional in development                                   |
| `EMAIL_FROM`    | Verified sender address in Brevo. Optional in development                |

If `BREVO_API_KEY` and `EMAIL_FROM` are empty outside production, the reset link is printed to the server console instead of being emailed.

Run it:

```bash
npm run dev     # dev server with auto-reload
npm run build   # type-check and compile to dist/
npm start       # run the compiled build
npm test        # run the test suite
```

## API reference

All routes are prefixed with `/api`. Errors return `{ "message": "..." }` with an appropriate status code.

### Auth

| Method | Route                  | Body                        | Notes                                                           |
| ------ | ---------------------- | --------------------------- | --------------------------------------------------------------- |
| POST   | `/auth/signup`         | `{ name, email, password }` | Returns `{ message, user }`. No token: the user logs in next    |
| POST   | `/auth/login`          | `{ email, password }`       | Returns `{ message, token, user }`                              |
| POST   | `/auth/forgot-password`| `{ email }`                 | Always replies 200 with the same message, whether or not the account exists |
| POST   | `/auth/reset-password` | `{ token, password }`       | Token comes from the emailed link. Single use, expires after 30 minutes. Password must be at least 8 characters |

### Tracks (requires `Authorization: Bearer <token>`)

| Method | Route         | Body              | Notes                           |
| ------ | ------------- | ----------------- | ------------------------------- |
| GET    | `/tracks`     | none              | Returns the caller's tracks     |
| POST   | `/tracks`     | `{ name, color }` | Name must be unique per user    |
| DELETE | `/tracks/:id` | none              | Cascades to the track's entries |

### Entries (requires `Authorization: Bearer <token>`)

| Method | Route          | Body                             | Notes                                                                                      |
| ------ | -------------- | -------------------------------- | ------------------------------------------------------------------------------------------ |
| GET | `/entries` | none | Cursor-paginated, newest date first. Query: `limit` (default 10, max 50) and `cursor`. Returns `{ data, nextCursor, hasNextPage }`. Pass `nextCursor` back as `cursor` for the next page |
| POST   | `/entries`     | `{ track, title, notes?, date }` | `date` as `YYYY-MM-DD`                                                                     |
| DELETE | `/entries/:id` | none                             | Must belong to the caller                                                                  |

### Rate limits

Limits are per IP address and use a 15-minute window. Going over returns `429` with `{ "message": "Too many attempts. Please try again in 15 minutes." }`.

| Routes                                            | Limit |
| ------------------------------------------------- | ----- |
| `/auth/forgot-password`, `/auth/reset-password`   | 5     |
| `/auth/signup`, `/auth/login`                     | 20    |

## Design decisions

- **Shared controller helpers.** Ownership checks, not-found lookups and duplicate-key detection live in `utils/controllerHelpers.ts` rather than being repeated per controller, so every resource-scoped route enforces the same rule.
- **Signup does not issue a token.** Login is the only place a token is created, so there is one path to a session.
- **Password reset avoids account enumeration.** `forgot-password` gives the same reply for known and unknown emails. Only a SHA-256 hash of the reset token is stored, the token can be used once, and it expires after 30 minutes.
- **Email over HTTPS, not SMTP.** Render's free tier blocks outbound SMTP ports, so reset emails go through Brevo's HTTP API.
- **Cursor pagination for entries.** Entries can be backfilled to past dates, so the cursor follows the same order users see rather than insertion order.

## Testing

```bash
npm test
```

Covers:

- `hashPassword` / `comparePassword`: salting and verification behavior
- `generateToken`: signing and verification against the correct secret
- Full auth flow: signup, duplicate email rejection, login, wrong password
- Password reset: unknown email, valid token used once, old password rejected, invalid token
- Track and entry CRUD, cross-user data isolation, cascade delete, ownership checks on delete

Integration tests run against an in-memory MongoDB instance (`mongodb-memory-server`), isolated from the real Atlas database. Rate limiting is switched off when `NODE_ENV` is `test`.

## Deployment

Hosted on Render, auto-deploying from `main`. Environment variables (`MONGO_URI`, `JWT_SECRET`, `CLIENT_URL`, `FRONTEND_URL`, `BREVO_API_KEY`, `EMAIL_FROM`) are set in Render's dashboard and never committed to the repo.

## Known limitations

- **Cold starts.** The free Render tier spins down after inactivity, so the first request can take 30 to 60 seconds.
- **In-memory rate limits.** Counters live in the server process, so they reset when the server restarts or spins down.
- **Email deliverability.** Reset emails are sent from a single verified sender address without a custom domain, so they may land in spam.