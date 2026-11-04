# Chess Analyzer

A web application for exploring chess games from Lichess and Chess.com, tracking personal statistics, and analyzing completed games with Stockfish.

> Early development. This repository currently contains project documentation and repository configuration. The application is not implemented yet. The project name is provisional.

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

## Planned repository structure

This project uses a single repository for independently runnable frontend and backend applications. The directories below will be added as implementation begins.

```text
apps/
  web/                 React application
  api/                 NestJS application and Prisma configuration
packages/
  contracts/           Shared API contracts, when needed
```

A browser extension may be added later as another application. Database models remain owned by the backend; shared API contracts describe the data exposed to clients.

## Development status

The next milestone is a functional demo covering public imports, game history, statistics, and basic game analysis. Setup and run instructions will be added when the application scaffold is available.

Local planning documents, assistant skills, credentials, editor state, dependencies, and generated outputs are excluded from version control. Source code, database migrations, dependency lockfiles, and safe environment variable examples belong in the repository.

## Project scope

The application focuses on completed games and post-game analysis. It is an independent project and is not affiliated with or endorsed by Lichess or Chess.com.
