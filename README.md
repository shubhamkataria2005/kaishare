# KaiShare – Surplus Food Rescue (PWA)

KaiShare connects Auckland food businesses that have surplus food at the end of the day (cafés, bakeries, grocers) with
the food banks, charities and volunteers who can collect it before it is thrown away.

**Feature 1: Surplus listings.** Donors post food with a quantity, dietary tags and a pickup window. Rescuers browse,
search and filter the open listings. Full CRUD.

**Feature 2: Pickup claims.** Rescuers claim a listing and choose a pickup time inside the window. Donors confirm or
decline, then mark the food collected. Rescuers can change the pickup time or cancel. Full CRUD.

## Tech stack

| Area | Technology |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 8, React Router 7 |
| PWA / offline | vite-plugin-pwa (Workbox, injectManifest), custom service worker, IndexedDB (`idb`) cache + outbox |
| Backend | Node.js 22+, Express 5, Mongoose 9, Zod 4 validation, Winston logging |
| Database | MongoDB replica set (local Docker `rs0`, or MongoDB Atlas) |
| Auth | JWT access tokens (15 min) + rotating refresh tokens in httpOnly cookies, Google OAuth 2 (Sign in with Google) |
| Push | Web Push API with VAPID keys (`web-push`, aes128gcm payload encryption) |
| Security | bcrypt, Helmet, CORS allow-list, rate limiting, NoSQL-injection protection, optional HTTPS |
| Testing | Vitest, Supertest, mongodb-memory-server, Testing Library, fake-indexeddb, Postman/Newman |

## Getting started

Prerequisites: Node.js 22.9+, Docker (for the local MongoDB replica set) or a MongoDB Atlas cluster.

```bash
npm run install:all                     # root, server and client dependencies
npm run db:up                           # 3-member MongoDB replica set in Docker (ports 27017-27019)
cp server/.env.example server/.env      # then set JWT_ACCESS_SECRET (and GOOGLE_CLIENT_ID if used)
npm --prefix server run vapid           # generates the VAPID key pair into server/.env
cp client/.env.example client/.env
npm run seed                            # demo accounts, listings and claims
npm run dev                             # API on :4000, web app on http://localhost:5173
```

Demo accounts (password `KaiShare2026`):

| Role | Email |
| --- | --- |
| Donor | mere@ponsonbybakehouse.nz |
| Rescuer | tama@kaicollective.org.nz |
| Admin | admin@kaishare.nz |

### Testing offline mode and push

The service worker precaches the production build, so test offline behaviour with a build:

```bash
npm run build && npm run preview        # http://localhost:4173
```

Then in Chrome DevTools > Application, tick **Offline** (or Network > Offline) and reload.

### Using MongoDB Atlas

Create a cluster, add a database user, allow your IP under Network Access, and set
`MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/kaishare?retryWrites=true&w=majority` in `server/.env`.
Atlas clusters are three-member replica sets, so no code changes are needed.

### Google sign-in

In Google Cloud Console create an OAuth client ID (type *Web application*) with the authorised JavaScript origins
`http://localhost:5173` and `http://localhost:4173`, then set `GOOGLE_CLIENT_ID` in `server/.env`.
The web app reads the client id from `GET /api/auth/providers`.

### HTTPS for the API

```bash
npm --prefix server run cert            # self-signed certificate in server/certs/
# server/.env: HTTPS_KEY_FILE=certs/localhost-key.pem  HTTPS_CERT_FILE=certs/localhost-cert.pem  COOKIE_SECURE=true
# client/.env: API_TARGET=https://localhost:4000
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | API (auto-restart) and Vite dev server together |
| `npm test` | All server and client tests |
| `npm --prefix server run test:coverage` | Server tests with a coverage report |
| `npm run build` / `npm run preview` | Production build of the PWA / serve it with the API |
| `npm run seed` | Reset the database with demo data |

## API

All routes are under `/api`. Protected routes need `Authorization: Bearer <accessToken>`.

| Method | Path | Who | Purpose |
| --- | --- | --- | --- |
| GET | `/health` | public | Status, database and replica set details |
| GET | `/auth/providers` | public | Enabled sign-in methods (Google client id) |
| POST | `/auth/register` | public | Create an account (donor or rescuer) |
| POST | `/auth/login` | public | Email + password sign-in |
| POST | `/auth/google` | public | Sign in with a Google ID token |
| POST | `/auth/refresh` | cookie | New access token, rotates the refresh token |
| POST | `/auth/logout` | cookie | Revoke the refresh token |
| GET / PATCH | `/auth/me` | signed in | Read / update own profile |
| GET | `/listings` | signed in | Open listings (`q`, `category`, `suburb`, `page`, `limit`) |
| GET | `/listings/mine` | donor | Own listings |
| GET | `/listings/:id` | signed in | One listing |
| POST | `/listings` | donor | Create |
| PATCH | `/listings/:id` | owner / admin | Update (only while available) |
| DELETE | `/listings/:id` | owner / admin | Delete (not while claimed) |
| GET | `/claims` | signed in | Rescuer: own claims · donor: claims on own listings · admin: all |
| GET | `/claims/:id` | rescuer / donor of the claim | One claim |
| POST | `/claims` | rescuer | Claim a listing |
| PATCH | `/claims/:id` | rescuer: `pickupTime`, `note` · donor: `status` | Update |
| DELETE | `/claims/:id` | rescuer | Cancel |
| GET | `/push/public-key` | public | VAPID public key |
| GET | `/push/status` | signed in | Number of subscribed devices |
| POST / DELETE | `/push/subscriptions` | signed in | Save / remove this browser's subscription |
| POST | `/push/test` | signed in | Test notification to own devices |
| POST | `/push/broadcast` | admin | Notification to every user |

The Postman collection and environments are in [`server/postman/`](server/postman). Run it in Postman (Run collection)
or from the command line:

```bash
npx newman run server/postman/KaiShare-API.postman_collection.json -e server/postman/KaiShare-Local-HTTP.postman_environment.json
```

## Architecture

```
client/src
  api/            HttpClient facade (token + refresh), one module per resource
  auth/           AuthProvider (session, offline mode), RequireAuth route guard
  data/           Repositories: network-first reads, offline outbox for writes
  offline/        IndexedDB database, cache, outbox, mutateOrQueue
  pwa/            Service worker registration, push subscription
  sw.ts           Service worker: precache, navigation fallback, runtime caching, push
  pages/, components/, hooks/, utils/

server/src
  config/         Validated environment, MongoDB connection (Singleton)
  models/         Mongoose schemas (User, Listing, Claim, PushSubscription, RefreshSession)
  repositories/   Repository pattern over Mongoose
  services/       Business rules (Auth, Listing, Claim + state machine, Notification)
  auth/           Token service, password hasher, sign-in strategies (local, Google)
  events/         EventBus (Observer) – services publish, listeners react
  notifications/  Web Push adapter and the listeners that send notifications
  middleware/     authenticate, authorize, validate, security, logging, errors
  controllers/, routes/
  container.js    Composition root (dependency injection)
```

Design patterns: Repository, Service layer, Dependency Injection (composition root), Strategy (sign-in methods),
Observer (event bus → push notifications), State (claim status transitions), Adapter (web-push, Google verifier),
Singleton (database connection, logger, HTTP client), Facade (frontend HTTP client), Chain of Responsibility
(Express middleware), Factory functions (controllers, validation middleware).
