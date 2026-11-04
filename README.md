# Chess Analyzer

A web application for exploring chess games from Lichess and Chess.com, tracking personal statistics, and analyzing completed games with Stockfish.

> Early development. The React frontend, NestJS API, and Prisma database foundation are scaffolded. Game imports, authentication, statistics, and analysis are not implemented yet. The project name is provisional.

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
   ```

4. Start both applications:

   ```sh
   npm run dev
   ```

Open [the frontend](http://127.0.0.1:5173). The API listens on port 3000; Vite forwards `/api` requests to it during development. If the API port changes, update the Vite proxy target too. Production hosting must configure its own API routing.

The API requires `DATABASE_URL` but connects lazily. `GET /api/health` checks that the process is running; `GET /api/health/ready` queries PostgreSQL and returns HTTP 503 if the database is unavailable. Readiness checks connectivity, not migration status.

## Development commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run the API and frontend together |
| `npm run build` | Generate Prisma Client and build both applications |
| `npm run typecheck` | Generate Prisma Client and check TypeScript |
| `npm run db:validate` | Validate the Prisma schema |
| `npm run db:migrate -w @chess-analyzer/api -- --name change_name` | Create and apply a development migration |
| `npm run db:deploy` | Apply committed migrations |
| `npm run db:studio` | Inspect the configured database |
| `npm run db:down` | Stop local PostgreSQL while retaining its volume |

For migration naming, run `npm run db:migrate -w @chess-analyzer/api -- --name change_name` from the root. Prisma commands use `apps/api/prisma.config.ts` and the API environment file. Generated Prisma Client files are ignored and regenerated locally. Commit schema changes, SQL migrations, and the dependency lockfile together.

The initial schema stores public external profiles and source PGN records. It intentionally does not represent verified ownership; account linking and richer game metadata will be added with their respective features.

## Development status

The next milestone is a functional demo covering public imports, game history, statistics, and basic game analysis.

Local planning documents, assistant skills, credentials, editor state, dependencies, and generated outputs are excluded from version control. Source code, database migrations, dependency lockfiles, and safe environment variable examples belong in the repository.

## Project scope

The application focuses on completed games and post-game analysis. It is an independent project and is not affiliated with or endorsed by Lichess or Chess.com.
