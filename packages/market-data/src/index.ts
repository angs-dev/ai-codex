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
