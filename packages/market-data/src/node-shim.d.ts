declare module "node:fs/promises" { export function readFile(path: string, encoding: "utf8"): Promise<string>; }
declare const fetch: (url:string, init?:{headers?:Record<string,string>})=>Promise<{ok:boolean;status:number;json():Promise<unknown>}>;
declare class WebSocket { static readonly OPEN:number; readonly readyState:number; binaryType:string; onopen:(event:unknown)=>void; onerror:(event:unknown)=>void; onmessage:(event:{data:unknown})=>void; onclose:(event:unknown)=>void; constructor(url:string);send(value:string):void;close():void; }
