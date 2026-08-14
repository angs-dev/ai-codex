# Roadmap and test strategy

## Delivery status

1. **Foundation:** workspace contracts, SQLite schema, source governor, CSV/replay providers, freshness, indicators, deterministic tests.
2. **Market data foundation:** a read-only Upstox Feed V3 adapter boundary, injected binary decoder, subscription/reconnect health, price reactions, and candle aggregation. Production use still requires validation against current official Upstox documentation and a protobuf decoder.
3. **Events:** deterministic classification, fingerprint deduplication, financial parsing, and one-off profit detection. Governed NSE/BSE network adapters remain provider integration work.
4. **Analysis/scoring:** extension, regime, event/trade/SWING-10 scoring, configurable weights, explainable hard gates, reaction and candle analysis.
5. **Paper trading:** ₹10,000-compatible risk sizing, simulated position updates, MFE/MAE and explicitly unvalidated statistics.
6. **Product:** lightweight API plus responsive React/MUI dashboard routes and Scan Now. Missing data is displayed rather than fabricated; detailed stock charts require live candles.
7. **Operations:** transition-deduplicated Telegram support, IST scheduler, `scan:once`, best-effort five-minute GitHub schedule, CI, and manual dispatch.

## Test strategy

Node’s built-in test runner executes offline deterministic fixtures. SQLite tests use isolated in-memory databases. Provider tests use CSV/replay data, never live services. Suites cover classification/deduplication, financial one-offs, reactions, candle aggregation/patterns, extension/regime/scoring/gates, paper sizing/outcomes/MFE/MAE, freshness, scan locking, IST weekends/closed sessions, and alert deduplication. Live-provider tests are opt-in and cannot gate CI.

## Known limitations

This repository is a production-oriented research foundation, not a validated trading product. NSE/BSE announcement adapters, Upstox protobuf decoding/instrument mapping, complete Nifty 500 reference data, exchange holiday updates, durable GitHub state, and validation-quality historical datasets require external provider integration. GitHub runners are ephemeral. The dashboard cannot show candles that providers did not supply. No real order execution exists or is planned.
