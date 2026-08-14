# Data sources and governance

## Source policy

Primary sources are preferred: NSE and BSE corporate announcements, exchange filings, and company investor-relations pages. Secondary reporting may supplement, but not silently replace, a primary filing. Every observation records provider, source type, publication/detection timestamps, raw payload, reference, symbol/company mapping confidence, and one of `REALTIME`, `NEAR_REALTIME`, `DELAYED`, `PERIODIC`, or `UNKNOWN`.

Adapters must comply with terms, robots/access controls, documented rate limits, and reasonable caching. A blocked endpoint is not scraped more aggressively. `SourceGovernor` supplies per-source cadence and concurrency bounds. Provider failures update health and surface missing data.

## Planned sources

| Source | Role | Expected classification | Status |
|---|---|---:|---|
| NSE corporate announcements | Primary filings | provider-declared; otherwise `UNKNOWN` | Milestone 3 research/adapter |
| BSE corporate announcements | Primary filings | provider-declared; otherwise `UNKNOWN` | Milestone 3 research/adapter |
| Company investor relations | Primary supporting documents | `PERIODIC`/`UNKNOWN` | Milestone 3 |
| Upstox Market Data Feed V3 | Read-only live ticks/candles | `REALTIME` or provider-documented | Milestone 2 |
| CSV/replay fixtures | Testing/import | `DELAYED` | Implemented |

Upstox implementation is deliberately deferred until Milestone 2, when current official documentation, authentication/token capabilities, subscriptions, limits, protobuf formats, reconnect guidance, and historical-candle availability will be verified. No order API will be used.

## Freshness

Freshness is computed from the actual data timestamp at a separate observation time. It contains timeliness, `FRESH | AGING | STALE | UNKNOWN`, age, thresholds, and an explanation. Initial configurable defaults are 5/15 seconds for realtime, 60/180 seconds for near-realtime, 20/30 minutes for delayed, and 1/24 hours for periodic data. `UNKNOWN` remains unknown. Stale or unknown required market data disables `PAPER_BUY`.

## GitHub runner limitation

GitHub-hosted runners are ephemeral and scheduled workflows are not reliable one-minute infrastructure. A later workflow will run approximately every five minutes on weekdays and support `workflow_dispatch`, but local SQLite cannot safely be assumed to persist between runs. Artifacts have retention/consistency limitations and repository commits every scan are unsafe. Unless a suitable zero-cost durable store is explicitly configured later, GitHub scans will be stateless best-effort alerts and must not authoritatively mutate deduplication state or paper positions. The local scanner remains authoritative.

## Upstox adapter boundary

`UpstoxMarketDataFeedV3Provider` performs bearer-token authorization, connects only to the authorized redirect URI, subscribes to configured instrument keys, accepts an injected protobuf decoder, tracks reconnects, and exposes ticks through the broker-neutral interface. It does not import or call any order API. The decoder is injected so schema changes remain isolated and fixture tests do not depend on live data. Before supplying production credentials, verify the authorization URL, token eligibility, subscription modes/limits, protobuf schema, and reconnect rules against the current official Upstox documentation; the build environment used for this change could not access external documentation.
