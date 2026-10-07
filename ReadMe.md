# Trackr API

![CI](https://github.com/VeekAustin/trackr-api/actions/workflows/ci.yml/badge.svg)

The backend for **Trackr** — a personal progress log where users create their own categories ("tracks") and log dated entries under them. Built as a full-stack capstone project to practice production-shaped backend patterns: auth, ownership-scoped data, cascading deletes, centralized error handling, and automated testing.

Live API: `https://trackr-api-pr90.onrender.com`
Frontend repo: [trackr-web](https://github.com/VeekAustin/trackr-web)

## Features

- **Auth** — signup/login with hashed passwords (bcrypt) and JWT-based sessions
- **Dynamic tracks** — users define their own categories (name + color) instead of a fixed list
- **Entries** — dated, titled log entries scoped to a track and a user
- **Ownership enforcement** — every write/delete checks the resource belongs to the requesting user
- **Cascade delete** — deleting a track removes its entries too
- **Role-aware tokens** — JWT payload carries a `role` claim; `restrictTo` middleware ready for future admin routes
- **Centralized error handling** — a custom `AppError` class + global error middleware instead of repeated try/catch boilerplate
- **Tested** — unit tests (hashing, JWT) and integration tests (auth flow, CRUD, ownership, cascade delete) via Vitest + Supertest + an in-memory MongoDB

## Tech stack

| Layer | Choice |
|---|---|
| Runtime | Node.js |
| Framework | Express 5 |
| Language | TypeScript |
| Database | MongoDB Atlas |
| ODM | Mongoose |
| Auth | bcryptjs, jsonwebtoken |
| Dev runner | tsx |
| Testing | Vitest, Supertest, mongodb-memory-server |
| Hosting | Render |

## Project structure

```
src/
  config/        # DB connection
  controllers/   # route handlers
  middleware/    # auth, roles, error handling
  models/        # Mongoose schemas
  routes/        # Express routers
  test/          # integration tests + test DB setup
  types/         # Express type extensions
  utils/         # hashing, JWT, AppError
  app.ts         # Express app (no listening)
  server.ts      # entry point — connects DB, starts server
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
```

Run it:

```bash
npm run dev     # dev server with auto-reload
npm run build   # type-check and compile to dist/
npm start       # run the compiled build
npm test        # run the test suite
```

## API reference

All routes are prefixed with `/api`.

### Auth

| Method | Route | Body | Notes |
|---|---|---|---|
| POST | `/auth/signup` | `{ name, email, password }` | Returns `{ token, user }` |
| POST | `/auth/login` | `{ email, password }` | Returns `{ token, user }` |

### Tracks — requires `Authorization: Bearer <token>`

| Method | Route | Body | Notes |
|---|---|---|---|
| GET | `/tracks` | — | Returns the caller's tracks |
| POST | `/tracks` | `{ name, color }` | Name must be unique per user |
| DELETE | `/tracks/:id` | — | Cascades to the track's entries |

### Entries — requires `Authorization: Bearer <token>`

| Method | Route | Body | Notes |
|---|---|---|---|
| GET | `/entries` | — | Returns the caller's entries |
| POST | `/entries` | `{ track, title, notes?, date }` | `date` as `YYYY-MM-DD` |
| DELETE | `/entries/:id` | — | Must belong to the caller |

## Design decision
Ownership checks and not-found lookups are centralized in `util/controllerHelpers.ts` rather than repeated per controller, so every resource-scoped route enforces the same rule.

## Testing

```bash
npm test
```

Covers:
- `hashPassword` / `comparePassword` — salting and verification behavior
- `generateToken` — signing and verification against the correct secret
- Full auth flow (signup, duplicate email rejection, login, wrong password)
- Track/entry CRUD, cross-user data isolation, cascade delete, ownership checks on delete

Integration tests run against an in-memory MongoDB instance (`mongodb-memory-server`), isolated from the real Atlas database.

## Deployment

Hosted on Render, auto-deploying from `main`. Environment variables (`MONGO_URI`, `JWT_SECRET`, `CLIENT_URL`) are set in Render's dashboard, not committed to the repo.