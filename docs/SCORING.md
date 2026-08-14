# Scoring and rejection policy

All scores are research hypotheses, not evidence of profitability. Inputs, missing values, component contributions, explanation text, configuration version, and provenance are persisted.

## Event quality (0–100)

`EventQualityScore` includes score, confidence, reasons, missing inputs, and the identified profit-growth driver. Result analysis may use revenue/PAT YoY and QoQ, EBITDA and margin changes, EPS, cash flow, debt, and guidance only when present. Profit attributed to `EXCEPTIONAL_INCOME`, `ASSET_SALE`, `TAX_BENEFIT`, `ACCOUNTING_CHANGE`, or `LOW_BASE` must not receive the same operating-quality interpretation as `OPERATING_IMPROVEMENT`; absent evidence is `UNKNOWN`, never invented.

## Trade quality (0–100)

`TradeQualityScore` explains market reaction, volume, VWAP, trend, relative strength, breakout/levels, extension, regime/sector, liquidity, entry quality, risk/reward, and overnight risk. Missing required inputs reduce confidence or trigger a gate.

## SWING-10 (0–100)

Initial configuration (unvalidated):

| Component | Weight |
|---|---:|
| Market regime | 15 |
| Fundamental/event | 15 |
| Trend/relative strength | 15 |
| Momentum | 10 |
| Candle | 10 |
| Volume | 10 |
| Entry quality | 25 |

Weights live in versioned configuration rather than calculation code. Each component stores raw score, weight, weighted score, and explanation. No single indicator creates a `PAPER_BUY`.

## Hard rejection gates

Scores never override safety gates. Initial gates are poor liquidity, stale data, insufficient data, risk/reward below threshold, extreme extension, failed breakout, negative event, `HIGH_RISK` market, abnormal spread, nearby major risk/event, and low-confidence source. Each gate records whether it triggered, `DOWNGRADE` or `REJECT`, observed value, configured threshold, and explanation. Rejection normally yields `IGNORE` or `NO_TRADE`; incomplete but potentially useful candidates may be `WATCH`. Only `PAPER_BUY`, `WATCH`, `IGNORE`, and `NO_TRADE` are valid actions.
