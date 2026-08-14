import type { DataTimeliness, SourceFreshness, NewsProvider, MarketDataProvider, RawEvent, ScanCandidateResult, ScanResult } from "@swing10/shared";

export interface FreshnessPolicy { freshForMs: number; staleAfterMs: number }
export const DEFAULT_FRESHNESS_POLICIES: Record<DataTimeliness, FreshnessPolicy> = {
  REALTIME: { freshForMs: 5_000, staleAfterMs: 15_000 },
  NEAR_REALTIME: { freshForMs: 60_000, staleAfterMs: 180_000 },
  DELAYED: { freshForMs: 20 * 60_000, staleAfterMs: 30 * 60_000 },
  PERIODIC: { freshForMs: 60 * 60_000, staleAfterMs: 24 * 60 * 60_000 },
  UNKNOWN: { freshForMs: 0, staleAfterMs: 0 }
};
export function assessFreshness(timeliness: DataTimeliness, dataAt: string | null, observedAt: string, policy: FreshnessPolicy = DEFAULT_FRESHNESS_POLICIES[timeliness]!): SourceFreshness {
  if (!dataAt || timeliness === "UNKNOWN") return { timeliness, status: "UNKNOWN", observedAt, ageMs: null, ...policy, reason: "No trustworthy data timestamp is available" };
  const ageMs = Math.max(0, Date.parse(observedAt) - Date.parse(dataAt));
  const status = ageMs <= policy.freshForMs ? "FRESH" : ageMs <= policy.staleAfterMs ? "AGING" : "STALE";
  return { timeliness, status, observedAt, ageMs, ...policy, reason: `${timeliness} data is ${status.toLowerCase()} at ${ageMs}ms old` };
}
export interface SourceGovernorOptions { minIntervalMs: number; maxConcurrent: number }
export class SourceGovernor {
  private active = 0; private lastStartedAt = Number.NEGATIVE_INFINITY;
  constructor(private readonly options: SourceGovernorOptions, private readonly now = () => Date.now(), private readonly sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))) {
    if (options.maxConcurrent < 1 || options.minIntervalMs < 0) throw new Error("Invalid governor options");
  }
  async run<T>(operation: () => Promise<T>): Promise<T> {
    while (this.active >= this.options.maxConcurrent) await this.sleep(1);
    const waitMs = Math.max(0, this.options.minIntervalMs - (this.now() - this.lastStartedAt));
    if (waitMs) await this.sleep(waitMs);
    this.active++; this.lastStartedAt = this.now();
    try { return await operation(); } finally { this.active--; }
  }
}
export interface CandidateAnalyser {analyse(symbol:string,event:RawEvent|undefined):Promise<ScanCandidateResult>}
export interface ScanEngineOptions {newsProviders:readonly NewsProvider[];marketDataProvider:MarketDataProvider;candidateAnalyser:CandidateAnalyser;marketTriggerSymbols?:()=>Promise<readonly string[]>;now?:()=>Date;id?:()=>string}
export class ScanEngine {private scanning=false;constructor(private readonly options:ScanEngineOptions){}
 async scanNow():Promise<ScanResult>{const now=this.options.now??(()=>new Date()),id=this.options.id??(()=>`scan-${Date.now()}`),startedAt=now().toISOString();if(this.scanning)return{scanRunId:id(),startedAt,completedAt:now().toISOString(),status:"SKIPPED_LOCKED",stage1:{eventsDiscovered:0,marketTriggers:0,symbolsTriggered:[]},stage2:{candidatesAnalysed:0,candidates:[]},sourceFreshness:{},errors:[]};this.scanning=true;const errors:ScanResult["errors"]=[],events:RawEvent[]=[];try{for(const provider of this.options.newsProviders){try{events.push(...await provider.fetchEvents({since:new Date(Date.parse(startedAt)-5*60_000).toISOString()}));}catch(error){errors.push({source:provider.name,message:error instanceof Error?error.message:String(error),retryable:true});}}let marketSymbols:readonly string[]=[];try{marketSymbols=await(this.options.marketTriggerSymbols?.()??Promise.resolve([]));}catch(error){errors.push({source:this.options.marketDataProvider.name,message:error instanceof Error?error.message:String(error),retryable:true});}const bySymbol=new Map<string,RawEvent|undefined>();for(const event of events)if(event.symbol)bySymbol.set(event.symbol,event);for(const symbol of marketSymbols)if(!bySymbol.has(symbol))bySymbol.set(symbol,undefined);const candidates:ScanCandidateResult[]=[];for(const [symbol,event] of bySymbol)try{candidates.push(await this.options.candidateAnalyser.analyse(symbol,event));}catch(error){errors.push({message:`${symbol}: ${error instanceof Error?error.message:String(error)}`,retryable:false});}const health=[...this.options.newsProviders.map(x=>x.health()),this.options.marketDataProvider.health()],sourceFreshness:Record<string,SourceFreshness>={};for(const h of health)sourceFreshness[h.provider]=assessFreshness(h.provider===this.options.marketDataProvider.name?this.options.marketDataProvider.timeliness:"UNKNOWN",h.lastDataAt,now().toISOString());return{scanRunId:id(),startedAt,completedAt:now().toISOString(),status:errors.length?"PARTIAL":"COMPLETED",stage1:{eventsDiscovered:events.length,marketTriggers:marketSymbols.length,symbolsTriggered:[...bySymbol.keys()]},stage2:{candidatesAnalysed:candidates.length,candidates},sourceFreshness,errors};}finally{this.scanning=false;}}
}
export type AlertTransition="NEW_HIGH_QUALITY_EVENT"|"WATCH_TO_PAPER_BUY"|"PAPER_BUY_INVALIDATED"|"TARGET_HIT"|"STOP_HIT"|"HIGH_RISK_MARKET"|"DATA_FEED_FAILURE";
export interface AlertMessage {deduplicationKey:string;transition:AlertTransition;text:string}
export interface AlertProvider {send(message:AlertMessage):Promise<void>}
export class DeduplicatingAlertEngine {private sent=new Set<string>();constructor(private readonly provider:AlertProvider){}async alert(message:AlertMessage):Promise<boolean>{if(this.sent.has(message.deduplicationKey))return false;await this.provider.send(message);this.sent.add(message.deduplicationKey);return true;}}
export class TelegramAlertProvider implements AlertProvider {constructor(private readonly token:string,private readonly chatId:string){if(!token||!chatId)throw new Error("Telegram credentials are required");}async send(message:AlertMessage):Promise<void>{const response=await fetch(`https://api.telegram.org/bot${this.token}/sendMessage`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({chat_id:this.chatId,text:`${message.text}\n\nPAPER TRADING ONLY\nSTRATEGY NOT VALIDATED`})});if(!response.ok)throw new Error(`Telegram alert failed (${response.status})`);}}
export function isIndianMarketSession(now=new Date(),holidays:readonly string[]=[]):boolean{const parts=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",weekday:"short",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(now).map(x=>[x.type,x.value]));if(parts.weekday==="Sat"||parts.weekday==="Sun")return false;const date=`${parts.year}-${parts.month}-${parts.day}`;if(holidays.includes(date))return false;const minutes=Number(parts.hour)*60+Number(parts.minute);return minutes>=555&&minutes<=930;}
