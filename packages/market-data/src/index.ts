import { readFile } from "node:fs/promises";
import type { Candle, MarketDataProvider, MarketDataRequest, MarketTick, ProviderHealth } from "@swing10/shared";

function parseNumber(value: string | undefined, field: string, line: number): number {
  const parsed = Number(value); if (!Number.isFinite(parsed)) throw new Error(`Invalid ${field} on CSV line ${line}`); return parsed;
}
export class CSVMarketDataProvider implements MarketDataProvider {
  readonly name = "CSV"; readonly timeliness = "DELAYED" as const; private candles: Candle[] = []; private connected = false; private lastSuccessAt: string | null = null;
  constructor(private readonly path: string) {}
  async connect(): Promise<void> {
    const content = await readFile(this.path, "utf8"); const lines = content.trim().split(/\r?\n/); const headers = lines.shift()?.split(",").map(x => x.trim());
    if (!headers) throw new Error("CSV is empty");
    const required = ["symbol","exchange","timeframe","exchangeTimestamp","localReceiveTimestamp","open","high","low","close","volume"];
    for (const h of required) if (!headers.includes(h)) throw new Error(`Missing CSV column: ${h}`);
    this.candles = lines.filter(Boolean).map((line, i) => { const values=line.split(",").map(x=>x.trim()); const row=Object.fromEntries(headers.map((h,j)=>[h,values[j]]));
      return { symbol: row.symbol!, exchange: row.exchange as Candle["exchange"], timeframe: row.timeframe as Candle["timeframe"], exchangeTimestamp: row.exchangeTimestamp!, localReceiveTimestamp: row.localReceiveTimestamp!, open: parseNumber(row.open,"open",i+2), high: parseNumber(row.high,"high",i+2), low: parseNumber(row.low,"low",i+2), close: parseNumber(row.close,"close",i+2), volume: parseNumber(row.volume,"volume",i+2) };
    }); this.connected=true; this.lastSuccessAt=new Date().toISOString();
  }
  async disconnect() { this.connected=false; }
  async getCandles(r: MarketDataRequest) { this.ensure(); const wanted=new Set(r.symbols); return this.candles.filter(c=>wanted.has(c.symbol)&&c.timeframe===r.timeframe&&c.exchangeTimestamp>=r.from&&c.exchangeTimestamp<=r.to); }
  async getLatestTicks(symbols: readonly string[]): Promise<readonly MarketTick[]> { this.ensure(); const wanted=new Set(symbols); const latest=new Map<string,Candle>(); for(const c of this.candles) if(wanted.has(c.symbol)&&(!latest.get(c.symbol)||c.exchangeTimestamp>latest.get(c.symbol)!.exchangeTimestamp)) latest.set(c.symbol,c); return [...latest.values()].map(c=>({symbol:c.symbol,exchange:c.exchange,lastPrice:c.close,cumulativeVolume:c.volume,exchangeTimestamp:c.exchangeTimestamp,localReceiveTimestamp:c.localReceiveTimestamp})); }
  health(): ProviderHealth { const latest=this.candles.reduce<string|null>((a,c)=>!a||c.exchangeTimestamp>a?c.exchangeTimestamp:a,null); return {provider:this.name,status:this.connected?"HEALTHY":"DOWN",lastSuccessAt:this.lastSuccessAt,lastDataAt:latest,reconnects:0}; }
  private ensure(){ if(!this.connected) throw new Error("CSV provider is not connected"); }
}
export class ReplayMarketDataProvider implements MarketDataProvider {
  readonly name="Replay"; readonly timeliness="DELAYED" as const; private connected=false; private cursor=0;
  constructor(private readonly candles: readonly Candle[]) {}
  async connect(){this.connected=true;} async disconnect(){this.connected=false;}
  advance(count=1){this.cursor=Math.min(this.candles.length,this.cursor+count);}
  async getCandles(r: MarketDataRequest){this.ensure();const s=new Set(r.symbols);return this.candles.slice(0,this.cursor).filter(c=>s.has(c.symbol)&&c.timeframe===r.timeframe&&c.exchangeTimestamp>=r.from&&c.exchangeTimestamp<=r.to);}
  async getLatestTicks(symbols:readonly string[]){this.ensure();const s=new Set(symbols),m=new Map<string,Candle>();for(const c of this.candles.slice(0,this.cursor))if(s.has(c.symbol))m.set(c.symbol,c);return [...m.values()].map(c=>({symbol:c.symbol,exchange:c.exchange,lastPrice:c.close,cumulativeVolume:c.volume,exchangeTimestamp:c.exchangeTimestamp,localReceiveTimestamp:c.localReceiveTimestamp}));}
  health():ProviderHealth{return {provider:this.name,status:this.connected?"HEALTHY":"DOWN",lastSuccessAt:null,lastDataAt:this.cursor?this.candles[this.cursor-1]!.exchangeTimestamp:null,reconnects:0};} private ensure(){if(!this.connected)throw new Error("Replay provider is not connected");}
}
export interface UpstoxFeedOptions {token:string;instrumentKeys:readonly string[];authorizeUrl?:string;decode:(payload:ArrayBuffer)=>readonly MarketTick[];maxReconnects?:number}
export class UpstoxMarketDataFeedV3Provider implements MarketDataProvider {
 readonly name="Upstox Market Data Feed V3";readonly timeliness="REALTIME" as const;private socket:WebSocket|null=null;private ticks=new Map<string,MarketTick>();private callbacks=new Set<(tick:MarketTick)=>void>();private lastSuccessAt:string|null=null;private reconnects=0;private stopped=true;
 constructor(private readonly options:UpstoxFeedOptions){if(!options.token)throw new Error("UPSTOX_ANALYTICS_TOKEN is required");}
 async connect():Promise<void>{this.stopped=false;const response=await fetch(this.options.authorizeUrl??"https://api.upstox.com/v3/feed/market-data-feed/authorize",{headers:{Authorization:`Bearer ${this.options.token}`,Accept:"application/json"}});if(!response.ok)throw new Error(`Upstox feed authorization failed (${response.status})`);const body=await response.json() as {data?:{authorizedRedirectUri?:string}};const uri=body.data?.authorizedRedirectUri;if(!uri)throw new Error("Upstox authorization response did not include a redirect URI");await this.open(uri);}
 private async open(uri:string):Promise<void>{await new Promise<void>((resolve,reject)=>{const ws=new WebSocket(uri);ws.binaryType="arraybuffer";ws.onopen=()=>{this.socket=ws;this.lastSuccessAt=new Date().toISOString();ws.send(JSON.stringify({guid:`swing10-${Date.now()}`,method:"sub",data:{mode:"full",instrumentKeys:this.options.instrumentKeys}}));resolve();};ws.onerror=()=>reject(new Error("Upstox WebSocket connection failed"));ws.onmessage=(message)=>{if(!(message.data instanceof ArrayBuffer))return;for(const tick of this.options.decode(message.data)){this.ticks.set(tick.symbol,tick);for(const callback of this.callbacks)callback(tick);}};ws.onclose=()=>{this.socket=null;if(!this.stopped&&this.reconnects<(this.options.maxReconnects??5)){this.reconnects++;setTimeout(()=>void this.connect(),Math.min(30_000,1_000*2**this.reconnects));}};});}
 async disconnect():Promise<void>{this.stopped=true;this.socket?.close();this.socket=null;}
 async getCandles(_request:MarketDataRequest):Promise<readonly Candle[]>{return[];}
 async getLatestTicks(symbols:readonly string[]):Promise<readonly MarketTick[]>{return symbols.flatMap(symbol=>{const tick=this.ticks.get(symbol);return tick?[tick]:[]});}
 async subscribe(_symbols:readonly string[],onTick:(tick:MarketTick)=>void):Promise<()=>Promise<void>>{this.callbacks.add(onTick);return async()=>{this.callbacks.delete(onTick);};}
 health():ProviderHealth{const last=[...this.ticks.values()].sort((a,b)=>b.exchangeTimestamp.localeCompare(a.exchangeTimestamp))[0];return{provider:this.name,status:this.socket?.readyState===WebSocket.OPEN?"HEALTHY":this.reconnects?"DEGRADED":"DOWN",lastSuccessAt:this.lastSuccessAt,lastDataAt:last?.exchangeTimestamp??null,reconnects:this.reconnects,...(!this.socket?{message:"WebSocket disconnected"}:{})};}
}
export interface PriceReaction {horizonMinutes:number;price:number;returnSinceEvent:number;volume:number|null;volumeRatio:number|null;vwap:number|null;distanceFromVwap:number|null;relativeStrengthVsNifty:number|null;relativeStrengthVsSector:number|null;exchangeTimestamp:string;localReceiveTimestamp:string}
export function calculatePriceReaction(eventPrice:number,tick:MarketTick,horizonMinutes:number,context:{volumeRatio?:number;vwap?:number;niftyReturn?:number;sectorReturn?:number}={}):PriceReaction {if(eventPrice<=0)throw new Error("Event price must be positive");const stockReturn=(tick.lastPrice-eventPrice)/eventPrice*100;return{horizonMinutes,price:tick.lastPrice,returnSinceEvent:stockReturn,volume:tick.cumulativeVolume??null,volumeRatio:context.volumeRatio??null,vwap:context.vwap??null,distanceFromVwap:context.vwap===undefined?null:(tick.lastPrice-context.vwap)/context.vwap*100,relativeStrengthVsNifty:context.niftyReturn===undefined?null:stockReturn-context.niftyReturn,relativeStrengthVsSector:context.sectorReturn===undefined?null:stockReturn-context.sectorReturn,exchangeTimestamp:tick.exchangeTimestamp,localReceiveTimestamp:tick.localReceiveTimestamp};}
