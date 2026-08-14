# Architecture

> **Safety boundary:** SWING-10 is paper-trading research software. The strategy is not validated. No component may place, route, or manage a real order.

## Principles

The system is a local-first TypeScript monorepo with SQLite as the authoritative local store. Raw observations are immutable and separate from derived features and versioned scores, enabling later re-scoring without rewriting history. Provider interfaces isolate external services. Missing or stale data is explicit and can never silently become a zero or an invented observation.

## Exact monorepo structure

```text
apps/
  api/                 HTTP/WebSocket composition (Milestone 6)
  dashboard/           React + MUI + Lightweight Charts (Milestone 6)
  scanner/             scan:once and continuous scheduler (Milestone 7)
packages/
  shared/              domain types and provider contracts
  core/                ScanEngine orchestration, freshness, source governance
  database/            SQLite connection, migrations, repositories
  market-data/         CSV, replay, and future Upstox adapters
  news/                NewsProvider contract and future primary-source adapters
  indicators/          pure deterministic technical calculations
  scoring/             event/trade/SWING-10 engines and rejection gates
  paper-trading/       simulated positions and outcomes; never broker orders
data/                   ignored local SQLite and imported fixtures
docs/                   architecture, sources, scoring, roadmap
.github/workflows/      CI and later approximate five-minute backup scanner
```

Applications are composition roots only. Shared packages own all trading research logic. The API, scanner, and GitHub workflow must call the same `ScanEngine.scanNow()` method.

## Scan flow

1. **Light scan:** governed providers fetch new announcements/news and cheap market triggers. Deduplication stores every raw observation while emitting canonical events once.
2. **Trigger selection:** liquidity-filtered symbols qualify through event, unusual-volume, early-momentum, pullback, breakout, relative-strength, sector-leadership, or fundamental triggers—not merely top gainers.
3. **Deep scan:** triggered symbols alone receive financial, reaction, technical, regime, extension, trade-quality, risk, and SWING-10 analysis.
4. **Hard gates:** gates override numerical scores. Stale data, extreme extension, and other rejection conditions prevent `PAPER_BUY`.
5. **Persistence/output:** all candidates, including rejected ones, explanations, raw inputs, score versions, simulated trades, and outcomes are stored.

Overlapping scans will be prevented by a process lock in the ScanEngine milestone. SQLite transactions protect each completed run; partial provider failures produce a `PARTIAL` result rather than fabricated data.

## Contracts

`packages/shared/src/index.ts` defines `MarketDataProvider`, `NewsProvider`, timestamped candles/ticks, `ScanResult`, `EventQualityScore`, `TradeQualityScore`, `Swing10Score`, freshness, and rejection-gate results. Exchange and local-receive timestamps remain separate end to end.

## Milestone 1 runtime components

- `Swing10Database` applies an idempotent, transactional SQLite migration and enables foreign keys/WAL.
- `SourceGovernor` bounds concurrency and request cadence without attempting to bypass source restrictions.
- `CSVMarketDataProvider` validates deterministic candle files; `ReplayMarketDataProvider` advances via an explicit cursor.
- Indicators are pure functions returning `null` when the available data cannot support a value.

Later dependencies point inward: apps → engines → provider interfaces/domain types. An Upstox adapter will provide market data only; this architecture intentionally has no order-provider abstraction.
