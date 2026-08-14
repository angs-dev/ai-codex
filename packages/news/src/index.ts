import { createHash } from "node:crypto";
import type { EventType, ProfitGrowthDriver, RawEvent } from "@swing10/shared";
export type { NewsProvider, NewsQuery, RawEvent } from "@swing10/shared";

const RULES: ReadonlyArray<[EventType, RegExp]> = [
 ["QUARTERLY_RESULT", /quarter(?:ly)?\s+(?:result|earnings)|q[1-4]\s+result/i], ["ANNUAL_RESULT", /annual\s+(?:result|earnings)/i],
 ["ORDER_WIN", /(?:wins?|receives?|secures?)\s+(?:an?\s+)?order|order\s+win/i], ["GUIDANCE_UP", /raises?\s+guidance|guidance\s+upgrade/i],
 ["GUIDANCE_DOWN", /cuts?\s+guidance|guidance\s+downgrade/i], ["CAPACITY_EXPANSION", /capacity\s+expansion|new\s+(?:plant|facility)/i],
 ["ACQUISITION", /acqui(?:res?|sition)/i], ["MERGER", /merger|amalgamation/i], ["DEBT_REDUCTION", /debt\s+(?:reduction|repayment)|deleverag/i],
 ["BUYBACK", /buyback/i], ["DIVIDEND", /dividend/i], ["REGULATORY_APPROVAL", /regulatory\s+approval|approved\s+by/i],
 ["REGULATORY_RISK", /regulatory\s+(?:risk|action|notice)|show.cause/i], ["MANAGEMENT_CHANGE", /(?:ceo|cfo|managing director)\s+(?:resigns?|appointed)/i],
 ["PRODUCT_LAUNCH", /product\s+launch|launches?\s+(?:a\s+)?new/i], ["PARTNERSHIP", /partnership|strategic\s+alliance/i],
 ["LITIGATION", /litigation|lawsuit|legal\s+proceeding/i], ["CREDIT_RATING", /credit\s+rating|rating\s+(?:upgrade|downgrade)/i],
 ["FUND_RAISE", /fund\s*rais|qualified institutional placement|rights issue/i], ["CONTRACT", /contract/i]
];
export function classifyEvent(text: string): { eventType: EventType; confidence: number; explanation: string } {
 for (const [eventType, pattern] of RULES) if (pattern.test(text)) return { eventType, confidence: 0.8, explanation: `Matched deterministic ${eventType} rule` };
 return { eventType: "OTHER_MATERIAL", confidence: 0.35, explanation: "No specific deterministic event rule matched" };
}
export function eventFingerprint(event: RawEvent): string { const normalized=[event.source,event.providerEventId??"",event.symbol??"",event.headline.toLowerCase().replace(/\s+/g," ").trim(),event.publishedAt??""].join("|");return createHash("sha256").update(normalized).digest("hex"); }
export class EventDeduplicator { private readonly seen=new Set<string>(); accept(event:RawEvent):boolean{const key=eventFingerprint(event);if(this.seen.has(key))return false;this.seen.add(key);return true;} restore(keys:readonly string[]):void{for(const key of keys)this.seen.add(key);} }
export interface ParsedFinancials { revenueGrowthYoY: number|null; patGrowthYoY:number|null; ebitdaGrowthYoY:number|null; marginPercent:number|null; profitGrowthDriver:ProfitGrowthDriver; evidence:string[] }
function percentage(text:string,label:RegExp):number|null{const match=text.match(new RegExp(`${label.source}[^%\\d+-]{0,30}([+-]?\\d+(?:\\.\\d+)?)\\s*%`,"i"));return match?.[1]===undefined?null:Number(match[1]);}
export function parseFinancials(text:string):ParsedFinancials { const evidence:string[]=[];const revenueGrowthYoY=percentage(text,/revenue/),patGrowthYoY=percentage(text,/(?:pat|profit after tax)/),ebitdaGrowthYoY=percentage(text,/ebitda/),marginPercent=percentage(text,/(?:ebitda )?margin/);let profitGrowthDriver:ProfitGrowthDriver="UNKNOWN";if(/exceptional (?:item|income)/i.test(text))profitGrowthDriver="EXCEPTIONAL_INCOME";else if(/asset sale|sale of (?:an? )?asset/i.test(text))profitGrowthDriver="ASSET_SALE";else if(/tax benefit|deferred tax/i.test(text))profitGrowthDriver="TAX_BENEFIT";else if(/low base/i.test(text))profitGrowthDriver="LOW_BASE";else if(patGrowthYoY!==null&&(revenueGrowthYoY!==null||ebitdaGrowthYoY!==null))profitGrowthDriver="OPERATING_IMPROVEMENT";for(const [name,value] of Object.entries({revenueGrowthYoY,patGrowthYoY,ebitdaGrowthYoY,marginPercent}))if(value!==null)evidence.push(`${name} parsed from supplied text`);return{revenueGrowthYoY,patGrowthYoY,ebitdaGrowthYoY,marginPercent,profitGrowthDriver,evidence}; }
