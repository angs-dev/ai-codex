# Roadmap and test strategy

## Milestones

1. **Foundation (implemented):** workspace architecture, domain contracts, SQLite schema, source governor, CSV/replay providers, freshness, SMA/EMA/VWAP/RSI/ATR/volume ratio, deterministic tests.
2. **Live market data:** verify current official Upstox Feed V3 documentation; implement read-only adapter, 1-minute aggregation, reconnect/backoff, latency and health. No order APIs.
3. **Events:** governed NSE/BSE/IR providers, classification, canonical deduplication, financial extraction, one-off detection, explainable event quality.
4. **Analysis/scoring:** timed reaction snapshots, candles/technicals, extension, regime, trade quality, configurable SWING-10, hard gates.
5. **Paper trading:** ₹10,000 simulated ledger, structure/ATR sizing, MFE/MAE, exits and validation statistics.
6. **Product:** lightweight API and responsive React/MUI dashboard, critical routes, open-source candlestick chart, scan lock and Scan Now.
7. **Operations:** transition-deduplicated Telegram alerts, IST session scheduler, `scan:once`, approximate five-minute GitHub workflow and manual dispatch.

A milestone does not proceed with broken tests.

## Test strategy

Node’s built-in test runner executes offline deterministic fixtures; later suites will use injected clocks. SQLite tests use isolated in-memory or temporary databases. Provider contract tests use CSV/replay data, never live services. Pure numerical routines assert known outputs, boundary behavior, insufficient input, and invalid data. Future suites cover classification/deduplication, financial provenance and one-offs, price reaction, candle patterns, extension/regime/scoring/gates, `NO_TRADE`, paper sizing/outcomes/MFE/MAE, stale data, reconnect/backoff, scan lock/CLI, IST weekends/holidays/closed sessions, alert transitions, API contracts, and dashboard accessibility/critical states.

Integration tests will assemble the real ScanEngine with fake providers and a temporary SQLite database. End-to-end smoke tests will verify `scan:once` and dashboard flows without network access. Live-provider tests remain opt-in and cannot gate normal CI. Test data must use neutral fixture symbols or be conspicuously labelled `DEMO DATA`; absence is rendered `DATA UNAVAILABLE`.

## Known Milestone 1 limitations

There is no live feed, news ingestion/classification, ScanEngine, scoring implementation, scheduler, Telegram, paper-trade engine, API, or dashboard yet. Replay ticks derive from completed fixture candles and are unsuitable as real tick simulation. CSV parsing intentionally supports simple unquoted fixture CSV; a robust streaming parser belongs in a later import feature. Market holidays and session logic arrive with the scheduler. The strategy remains unvalidated.
