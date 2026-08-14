declare const fetch:(url:string,init:{method:string;headers:Record<string,string>;body:string})=>Promise<{ok:boolean;status:number}>;
