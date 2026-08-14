# SWING-10 Market Intelligence

Local-first Indian market intelligence and **paper-trading research** platform. The strategy is not validated and this repository contains no automatic order execution.

Milestone 1 provides shared domain contracts, SQLite schema/migrations, governed data-source access, deterministic CSV/replay market-data adapters, and technical indicators.

```bash
npm install
npm test
npm run typecheck
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for boundaries and the exact monorepo plan.
