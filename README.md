# SWING-10 Market Intelligence

Local-first Indian market intelligence and **paper-trading research** platform. The strategy is not validated. This repository contains no automatic order execution.

## Run locally

Requires Node.js 24+.

```bash
npm install
npm test
npm run scan:once          # one complete, non-overlapping scan
npm run scanner:start      # one-minute, IST-session-aware local scanner
npm run api:start          # http://localhost:3001
npm run dashboard:start    # http://localhost:5173
```

Without configured live/news providers, the application truthfully returns `DATA UNAVAILABLE` and never produces a `PAPER_BUY`. Copy `.env.example` to `.env`; never commit credentials.

## GitHub Actions

Pushing runs CI. The market scan workflow runs on a best-effort approximately five-minute weekday schedule and can be started from GitHub's **Run workflow** button. Scheduled jobs are not reliable one-minute infrastructure and their SQLite state is ephemeral; the local scanner remains authoritative.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/DATA-SOURCES.md`](docs/DATA-SOURCES.md), and [`docs/SCORING.md`](docs/SCORING.md).
