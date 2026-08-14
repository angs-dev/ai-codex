export type ISODateTime = string;
export type Exchange = "NSE" | "BSE";
export type Timeframe = "1m" | "5m" | "15m" | "1D" | "1W";
export type DataTimeliness = "REALTIME" | "NEAR_REALTIME" | "DELAYED" | "PERIODIC" | "UNKNOWN";
export type DataFreshnessStatus = "FRESH" | "AGING" | "STALE" | "UNKNOWN";
export type SignalAction = "PAPER_BUY" | "WATCH" | "IGNORE" | "NO_TRADE";
export type ExtensionRisk = "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
export type MarketRegime = "BULLISH" | "MILD_BULLISH" | "NEUTRAL" | "MILD_BEARISH" | "BEARISH" | "HIGH_RISK";
export type EventType =
  | "QUARTERLY_RESULT" | "ANNUAL_RESULT" | "ORDER_WIN" | "CONTRACT"
  | "GUIDANCE_UP" | "GUIDANCE_DOWN" | "CAPACITY_EXPANSION" | "ACQUISITION"
  | "MERGER" | "DIVESTMENT" | "DEBT_REDUCTION" | "FUND_RAISE" | "BUYBACK"
  | "DIVIDEND" | "REGULATORY_APPROVAL" | "REGULATORY_RISK" | "PROMOTER_ACTIVITY"
  | "INSTITUTIONAL_ACTIVITY" | "MANAGEMENT_CHANGE" | "PRODUCT_LAUNCH"
  | "PARTNERSHIP" | "LITIGATION" | "CREDIT_RATING" | "OTHER_MATERIAL";
export type ProfitGrowthDriver = "OPERATING_IMPROVEMENT" | "EXCEPTIONAL_INCOME" | "ASSET_SALE" | "TAX_BENEFIT" | "ACCOUNTING_CHANGE" | "LOW_BASE" | "UNKNOWN";

export interface TimestampPair { exchangeTimestamp: ISODateTime; localReceiveTimestamp: ISODateTime }
export interface Candle extends TimestampPair {
  symbol: string; exchange: Exchange; timeframe: Timeframe;
  open: number; high: number; low: number; close: number; volume: number;
}
export interface MarketTick extends TimestampPair {
  symbol: string; exchange: Exchange; lastPrice: number; cumulativeVolume?: number;
  bid?: number; ask?: number;
}
export interface SourceFreshness {
  timeliness: DataTimeliness; status: DataFreshnessStatus; observedAt: ISODateTime;
  ageMs: number | null; freshForMs: number; staleAfterMs: number; reason: string;
}
export interface RawEvent {
  providerEventId?: string; source: string; sourceType: string; timeliness: DataTimeliness;
  publishedAt: ISODateTime | null; detectedAt: ISODateTime; headline: string;
  rawText: string | null; symbol: string | null; company: string | null;
  eventType: EventType; materiality: number | null; confidence: number;
  sourceReference: string; rawPayload: unknown;
}
export interface ScoreReason { component: string; contribution: number; explanation: string; inputs: Record<string, number | string | boolean | null> }
export interface EventQualityScore { score: number; confidence: number; profitGrowthDriver: ProfitGrowthDriver; reasons: ScoreReason[]; missingInputs: string[] }
export interface TradeQualityScore { score: number; reasons: ScoreReason[]; risks: string[]; missingInputs: string[] }
export type Swing10Component = "marketRegime" | "fundamentalEvent" | "trendRelativeStrength" | "momentum" | "candle" | "volume" | "entryQuality";
export interface Swing10Score { score: number; configurationVersion: string; components: Record<Swing10Component, { rawScore: number; weight: number; weightedScore: number; explanation: string }> }
export type RejectionGateCode = "POOR_LIQUIDITY" | "STALE_DATA" | "INSUFFICIENT_DATA" | "LOW_RISK_REWARD" | "EXTREME_EXTENSION" | "FAILED_BREAKOUT" | "NEGATIVE_EVENT" | "HIGH_RISK_MARKET" | "ABNORMAL_SPREAD" | "NEARBY_MAJOR_RISK" | "LOW_CONFIDENCE_SOURCE";
export interface RejectionGateResult { code: RejectionGateCode; triggered: boolean; severity: "DOWNGRADE" | "REJECT"; explanation: string; observedValue: number | string | boolean | null; threshold: number | string | boolean | null }
export interface ScanCandidateResult { symbol: string; action: SignalAction; eventQuality?: EventQualityScore; tradeQuality?: TradeQualityScore; swing10?: Swing10Score; gates: RejectionGateResult[]; explanation: string[] }
export interface ScanResult {
  scanRunId: string; startedAt: ISODateTime; completedAt: ISODateTime;
  status: "COMPLETED" | "PARTIAL" | "FAILED" | "SKIPPED_LOCKED";
  stage1: { eventsDiscovered: number; marketTriggers: number; symbolsTriggered: string[] };
  stage2: { candidatesAnalysed: number; candidates: ScanCandidateResult[] };
  sourceFreshness: Record<string, SourceFreshness>; errors: Array<{ source?: string; message: string; retryable: boolean }>;
}
export interface MarketDataRequest { symbols: string[]; from: ISODateTime; to: ISODateTime; timeframe: Timeframe }
export interface ProviderHealth { provider: string; status: "HEALTHY" | "DEGRADED" | "DOWN"; lastSuccessAt: ISODateTime | null; lastDataAt: ISODateTime | null; reconnects: number; message?: string }
export interface MarketDataProvider {
  readonly name: string; readonly timeliness: DataTimeliness;
  connect(): Promise<void>; disconnect(): Promise<void>;
  getCandles(request: MarketDataRequest): Promise<readonly Candle[]>;
  getLatestTicks(symbols: readonly string[]): Promise<readonly MarketTick[]>;
  subscribe?(symbols: readonly string[], onTick: (tick: MarketTick) => void): Promise<() => Promise<void>>;
  health(): ProviderHealth;
}
export interface NewsQuery { since: ISODateTime; symbols?: readonly string[]; limit?: number }
export interface NewsProvider {
  readonly name: string; readonly sourceType: string; readonly timeliness: DataTimeliness;
  fetchEvents(query: NewsQuery): Promise<readonly RawEvent[]>;
  health(): ProviderHealth;
}
