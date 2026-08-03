import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {KnowledgeStore} from './store.mjs';
import {handleRequest} from './api.mjs';

const store=await KnowledgeStore.fromFile();const port=Number(process.env.PORT||8788);
http.createServer(async(req,res)=>{const chunks=[];for await(const chunk of req)chunks.push(chunk);try{if(req.method==='GET'&&(req.url==='/'||req.url==='/index.html')){const html=await readFile(new URL('../public/index.html',import.meta.url));res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(html);return;}const response=await handleRequest(store,{method:req.method,url:req.url,body:Buffer.concat(chunks).toString('utf8')});res.writeHead(response.status,response.headers);res.end(response.body);}catch(error){res.writeHead(400,{'content-type':'application/json'});res.end(JSON.stringify({error:'bad_request',message:error.message}));}}).listen(port,()=>console.log(`QuelChampagne Engine : http://localhost:${port} · ${store.size} références`));
