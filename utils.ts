import axios,{CreateAxiosDefaults}  from "axios";
import "dotenv/config";

export const requestConfig:CreateAxiosDefaults = Object.freeze({
    headers: { 'Content-Type': 'application/x-ndjson' },
    auth: { username: process.env.AUTH_USERNAME || "", password: process.env.AUTH_PASSWORD || ""},
    httpsAgent: new (require('https')).Agent({ rejectUnauthorized: false }),
});

export const delay=({ms}:{ms:number})=>new Promise((res,rej)=>setTimeout(()=>res("done"),ms));