# Chess Analyzer

A web application for exploring chess games from Lichess and Chess.com, tracking personal statistics, and analyzing completed games with Stockfish.

> Early development. The public homepage, registration, login and a protected account page support English, Russian and Latvian, dark and light themes. The NestJS API stores users and sessions in PostgreSQL through Prisma. Game imports, statistics, rating charts, analysis and an interactive demo are not implemented yet. The project name is provisional.

## Planned features

- Import public game history from Lichess and Chess.com by username.
- Browse games with filters for platform, color, result, date, and time control.
- Explore results by color, recent games, and opening.
- Load PGN files and replay completed games on an interactive board.
- Analyze selected games in the browser with Stockfish.
- Save analysis results and selected profiles in a personal account.
- Verify ownership of linked chess accounts through supported authentication flows.

Public profile lookup does not establish account ownership. Verified account linking will be introduced separately. The initial demo will use public game imports; an application for Chess.com OAuth access is planned after the demo is ready.

## Technology direction

| Area | Technology |
| --- | --- |
| Frontend | React, TypeScript, Vite |
| Backend | NestJS, TypeScript |
| Database | PostgreSQL |
| Database access and migrations | Prisma |
| Chess rules and PGN | chess.js |
| Analysis | Stockfish running in a browser Web Worker |
| API | REST |

Specific dependency versions and browser engine builds will be selected during prototyping.

## Repository structure

This project uses npm workspaces for independently runnable frontend and backend applications.

```text
apps/
  web/                 React application
  api/                 NestJS application and Prisma configuration
compose.yaml           Local PostgreSQL service
```

A browser extension may be added later as another application. Database models remain owned by the backend. A shared contracts package can be introduced when API consumers need it.

## Local setup

Requirements: Node.js 22.12+ within the 22.x release line, or Node.js 24+, npm, and Docker Compose (or an existing PostgreSQL database).

1. Install dependencies from the repository root:

   ```sh
   npm ci
   ```

2. Copy `apps/api/.env.example` to `apps/api/.env`. In PowerShell:

   ```powershell
   Copy-Item apps/api/.env.example apps/api/.env
   ```

   The example credentials are for local development only. Use a separate database and credentials for deployed environments. If port 5432 is occupied, change the Compose host port and `DATABASE_URL` together.

3. Start PostgreSQL and apply the committed migrations:

   ```sh
   npm run db:up
   npm run db:deploy
   npm run db:generate
   npm run db:check
   ```

4. Start both applications:

   ```sh
   npm run dev
   ```

Open [the frontend](http://127.0.0.1:5173). The API listens on port 3000; Vite forwards `/api` requests to it during development. If the API port changes, update the Vite proxy target too. Production hosting must configure its own API routing.

The API requires `DATABASE_URL` but connects lazily. `GET /api/health` checks that the process is running; `GET /api/health/ready` queries PostgreSQL and returns HTTP 503 if the database is unavailable. Readiness checks connectivity, not migration status.

The read-only `npm run db:check` command uses `apps/api/.env`, verifies committed migration checksums, queries the existing tables, and starts a temporary NestJS listener on an ephemeral loopback port to check HTTP readiness. It closes that listener after the check and does not create fixture records. It can run alongside the dev server.

The homepage requires no login. `/register` creates a local account and signs in; `/login` accepts a username or email and password; `/app` requires an active session. The account page contains only account details and logout. The demo button explains that the public demo is not available yet. Language and theme preferences persist in browser storage when available; language is also stored in the user profile and restored after login. No chess functionality is simulated.

### Local authentication

Registration requires a username, email, password and matching password confirmation. Usernames contain 3–32 ASCII letters, digits or underscores; `@` is prohibited to keep email login unambiguous. Usernames and emails are trimmed and compared case-insensitively. Unique indexes on normalized columns and database canonicalization checks enforce these rules even under concurrent registration. Passwords contain 15–128 UTF-16 code units and are never trimmed or case-folded.

Passwords use asynchronous Node.js scrypt with `N=131072`, `r=8`, `p=1`, a random 16-byte salt, a 64-byte derived key and a 160 MiB OpenSSL memory ceiling. Algorithm, parameters, salt and hash are stored together. Comparisons use constant-time equality. Unknown users and passwordless accounts also perform a derivation. At most two derivations run concurrently per API process; excess requests receive HTTP 429. These parameters follow the [OWASP scrypt recommendation](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

Session tokens contain 32 random bytes. Only their SHA-256 hashes are stored in PostgreSQL. Sessions have a fixed seven-day lifetime without sliding renewal. Login rotates the browser's previous session; logout deletes the current session before clearing the cookie. Expired sessions are rejected server-side and removed opportunistically for the signing-in user. Other devices retain their independent sessions. Registration creates the user and session in one transaction.

The cookie is `chess_session` locally and `__Secure-chess_session` in production: `HttpOnly`, `SameSite=Lax`, `Path=/api`, no `Domain`, and `Max-Age=604800`. Production requires `NODE_ENV=production`, HTTPS and an explicit HTTPS `APP_ORIGIN`. Production cookies also carry `Secure`. Authentication responses use `Cache-Control: no-store`; tokens are never returned in JSON or stored in browser storage.

For every changing API request, including registration, login and logout, the server requires an exact `Origin` match with `APP_ORIGIN`, JSON content type and `X-CSRF-Protection: 1`. Missing/null origins and cross-site Fetch Metadata are rejected. The custom header is a same-origin request requirement, not a secret token. CORS is not enabled. This combines [OWASP's origin checking and custom-header CSRF defenses](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) with SameSite cookies. Serve the frontend and `/api` under the same origin; keep the production frontend and its scripts trusted. Open the local frontend at `http://127.0.0.1:5173`, or update `APP_ORIGIN` to its exact address.

The global NestJS guard protects API endpoints by default. Only health checks, registration, login and idempotent logout are explicitly public. Private React routes wait for a server session check and redirect guests to login; API authorization is enforced independently of frontend routing. Hosting must serve the SPA entry point for direct visits to `/register`, `/login` and `/app`, and route `/api` to NestJS.

Registration is limited to 10 requests per IP per 15 minutes; login to 20 per IP and 10 per normalized identifier per 15 minutes, including successful attempts. Limits are bounded in-memory counters in one API process and reset on restart. Forwarded IP headers are not trusted. A multi-instance deployment or deployment behind a proxy needs a shared limiter and an explicitly trusted proxy configuration before public launch; no Redis or proxy trust is enabled implicitly.

Email is **not verified**. The schema permits null email and password hash for future OAuth identities, but local registration always requires both. OAuth, email verification, password recovery, chess account linking and statistics are not implemented. No account is automatically merged by email.

### Authentication integration checks

`npm run test:auth` migrates and tests only a separately configured PostgreSQL database. It refuses a database without an `_auth_test` suffix or with the same database name as `DATABASE_URL`. It never migrates or inserts fixtures into the normal application database. Create the dedicated database once (for the WSL setup):

```powershell
wsl -d Ubuntu-24.04 -u root --cd /mnt/f/project -- docker compose exec -T db createdb -U chess chess_analyzer_auth_test
$env:TEST_DATABASE_URL = 'postgresql://chess:local_chess_password@localhost:5432/chess_analyzer_auth_test?schema=public'
npm run test:auth
```

Keep WSL running as described below. Alternatively put `TEST_DATABASE_URL` in the ignored `apps/api/.env`. The test database must already exist; the check applies committed migrations, starts temporary API listeners on loopback ephemeral ports, and removes its own user/session fixtures in a `finally` block. Checks cover validation, concurrent username/email conflicts, database constraints, password hashing, CSRF on registration/login/logout, cookie attributes, session restart/rotation/expiry/revocation, private-by-default API behavior, language preferences, nullable future identity fields and IP/identifier request limits. Never point this command at a database containing valuable data.

### Docker Engine in WSL without Docker Desktop

Docker Engine and the Compose plugin can run in Ubuntu 24.04 on WSL 2 while Node.js, Prisma, and NestJS run on Windows. The commands below assume the distribution is named `Ubuntu-24.04` and the repository is at `F:\project`. Docker Desktop is not required. Install Engine and Compose inside the distribution using the [official Docker instructions](https://docs.docker.com/engine/install/ubuntu/).

Keep a WSL session open while using the database. WSL can shut down after its last Linux process exits, even with systemd services enabled. In a separate PowerShell terminal, run and leave this command active:

```powershell
wsl -d Ubuntu-24.04 -u root --exec sleep infinity
```

Then run these commands from `F:\project` in another PowerShell terminal. Use the WSL Compose command instead of `npm run db:up` when Docker CLI is only installed inside WSL:

```powershell
wsl -d Ubuntu-24.04 -u root -- systemctl start docker
wsl -d Ubuntu-24.04 -u root --cd /mnt/f/project -- docker compose up -d --wait db
npm run db:deploy
npm run db:generate
npm run build -w @chess-analyzer/api
npm run start -w @chess-analyzer/api
```

The existing `DATABASE_URL` uses `localhost:5432`; WSL forwards the published database port to Windows. Check readiness from another PowerShell terminal:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/health/ready
```

Expect `status: ok` and `database: connected`. Run `npm run db:deploy` again to confirm there are no pending migrations. To stop PostgreSQL while retaining its data, run the command below, then press Ctrl+C in the WSL keep-alive terminal:

```powershell
wsl -d Ubuntu-24.04 -u root --cd /mnt/f/project -- docker compose down
```

## Development commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run the API and frontend together |
| `npm run build` | Generate Prisma Client and build both applications |
| `npm run typecheck` | Generate Prisma Client and check TypeScript |
| `npm run db:validate` | Validate the Prisma schema |
| `npm run db:migrate -w @chess-analyzer/api -- --name change_name` | Create and apply a development migration |
| `npm run db:deploy` | Apply committed migrations |
| `npm run db:check` | Generate/build the API, query PostgreSQL through Prisma, verify migration checksums and test HTTP readiness |
| `npm run test:auth` | Build the API and run authentication checks in a dedicated test database |
| `npm run db:studio` | Inspect the configured database |
| `npm run db:down` | Stop local PostgreSQL while retaining its volume |

For migration naming, run `npm run db:migrate -w @chess-analyzer/api -- --name change_name` from the root. Prisma commands use `apps/api/prisma.config.ts` and the API environment file. Generated Prisma Client files are ignored and regenerated locally. Commit schema changes, SQL migrations, and the dependency lockfile together.

The schema stores local users, server-side sessions, public external profiles and source PGN records. It intentionally does not represent verified chess account ownership; account linking and richer game metadata will be added with their respective features.

## Development status

The next milestone is a functional demo covering public imports, game history, statistics, and basic game analysis.

Local planning documents, assistant skills, credentials, editor state, dependencies, and generated outputs are excluded from version control. Source code, database migrations, dependency lockfiles, and safe environment variable examples belong in the repository.

## Project scope

The application focuses on completed games and post-game analysis. It is an independent project and is not affiliated with or endorsed by Lichess or Chess.com.
