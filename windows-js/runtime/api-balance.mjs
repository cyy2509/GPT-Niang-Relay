import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {windowsFetch} from './api-balance-windows-fetch.mjs';

const ORIGIN='https://portdan.com';
const fail=(error,errorCode)=>({ok:false,queryOk:false,source:'api-balance',plan:null,planLabel:'API 余额',planKnown:false,authType:'apiKey',windows:[],error,errorCode});
function numeric(value){
  if(typeof value==='string' && !/^-?\d+(?:\.\d+)?$/.test(value.trim()))return null;
  if(typeof value!=='number' && typeof value!=='string')return null;
  const amount=Number(value);
  return Number.isFinite(amount)?amount:null;
}

// Read only the single-line string settings needed for this connection.
// Unsupported TOML syntax fails closed; credentials are never guessed.
const portdan = {path:'/v1/usage', currency:'USD', balanceField:'balance', todayField:'usage.today.actual_cost'};

function configuredProvider(text){
  const tables=new Map([['',new Map()]]);
  let table=tables.get('');
  for(const line of text.replace(/^\uFEFF/,'').split(/\r?\n/)){
    const heading=line.match(/^\s*\[([^\[\]]+)\]\s*(?:#.*)?$/);
    if(heading){const name=heading[1].trim().replace(/"([A-Za-z0-9_-]+)"|'([A-Za-z0-9_-]+)'/g,'$1$2');table=tables.get(name)??new Map();tables.set(name,table);continue;}
    const pair=line.match(/^\s*([A-Za-z0-9_-]+)\s*=\s*("(?:[^"\\]|\\.)*"|'[^']*')\s*(?:#.*)?$/);
    if(pair){let value;try{value=pair[2][0]==='"'?JSON.parse(pair[2]):pair[2].slice(1,-1);}catch{continue;}table.set(pair[1],value);}
  }
  const root=tables.get('');
  const profile=root.get('profile');
  const provider=(profile?tables.get('profiles.'+profile)?.get('model_provider'):null)??root.get('model_provider');
  const settings=tables.get('model_providers.'+provider);
  if(provider && !settings && provider!=='openai')throw new Error('API_CONFIG_UNAVAILABLE');
  return settings;
}

export function connectionFromToml(text,env=process.env,providers={}){
  const settings=configuredProvider(text);
  if(!settings)throw new Error('API_OFFICIAL');
  let url;try{url=new URL(settings.get('base_url'));}catch{throw new Error('API_CONFIG_UNAVAILABLE');}
  if(url.protocol!=='https:' || url.username || url.password || url.search || url.hash)throw new Error('API_ORIGIN_CHANGED');
  const adapter=url.origin===ORIGIN?portdan:Object.hasOwn(providers ?? {},url.origin)?providers[url.origin]:null;
  if(!adapter)throw Object.assign(new Error('API_PROVIDER_UNSUPPORTED'),{origin:url.origin});
  if(typeof adapter.path!=='string' || !/^\/(?!\/)[A-Za-z0-9/_.~-]+$/.test(adapter.path) ||
      !/^[A-Z]{3}$/.test(adapter.currency) || !validField(adapter.balanceField) ||
      (adapter.todayField!==undefined && !validField(adapter.todayField)))throw new Error('API_CONFIG_UNAVAILABLE');
  const endpoint=new URL(adapter.path,url.origin);
  if(endpoint.origin!==url.origin)throw new Error('API_ORIGIN_CHANGED');
  const keyName=settings.get('env_key');
  const token=keyName?env[keyName]:settings.get('experimental_bearer_token');
  if(typeof token!=='string' || !token.trim() || /[\r\n]/.test(token))throw Object.assign(new Error('API_CREDENTIAL_UNAVAILABLE'),{origin:url.origin});
  return {origin:url.origin,endpoint:endpoint.href,adapter,token};
}

function validField(field){
  return typeof field==='string' && /^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/.test(field);
}

function fieldValue(data,field){
  return field?.split('.').reduce((value,key)=>value!=null && Object.hasOwn(value,key)?value[key]:undefined,data);
}

export function readConnection(env=process.env){
  const configHome=env.CODEX_HOME || path.join(os.homedir(),'.codex');
  let providers={};
  try{providers=JSON.parse(fs.readFileSync(path.join(configHome,'gpt-niang-balance-providers.json'),'utf8').replace(/^\uFEFF/,''));}
  catch(error){if(error.code!=='ENOENT')throw error;}
  return connectionFromToml(fs.readFileSync(path.join(configHome,'config.toml'),'utf8'),env,providers);
}

function normalizeConfiguredUsage(raw,adapter,now){
  const amount=numeric(fieldValue(raw,adapter.balanceField));
  if(amount===null)return fail('余额字段缺失或不是数字','API_INVALID_RESPONSE');
  const today=numeric(fieldValue(raw,adapter.todayField));
  return {ok:true,queryOk:true,source:'api-balance',observedAt:now,plan:null,planLabel:'API 余额',planKnown:false,planSource:'api',authType:'apiKey',windows:[],balance:{amount,currency:adapter.currency,scope:'account',todaySpent:today!==null && today>=0?today:null}};
}

export function normalizePortdanUsage(raw,now=Date.now()){
  if(raw?.isValid!==true)return fail('API 密钥状态无效，请检查连接配置','API_AUTH_FAILED');
  if(raw.unit!=='USD')return fail('余额单位未确认，暂不显示金额','API_UNIT_UNCONFIRMED');
  const balance=numeric(raw.balance),remaining=numeric(raw.remaining);
  if(balance===null || remaining===null || balance!==remaining)return fail('余额接口返回的数据不完整，暂不显示金额','API_INVALID_RESPONSE');
  const today=numeric(raw.usage?.today?.actual_cost);
  return {ok:true,queryOk:true,source:'api-balance',observedAt:now,plan:null,planLabel:'API 余额',planKnown:false,planSource:'api',authType:'apiKey',windows:[],balance:{amount:balance,currency:'USD',scope:'account',todaySpent:today!==null && today>=0?today:null}};
}

export async function queryPortdanBalance(connection,{fetchImpl=process.platform==='win32'?windowsFetch:fetch,timeoutMs=18000,now=Date.now,onAccount=()=>{}}={}){
  const endpoint=URL.canParse(connection?.endpoint ?? '')?new URL(connection.endpoint):null;
  if(!endpoint || endpoint.protocol!=='https:' || endpoint.origin!==connection.origin || endpoint.username || endpoint.password || typeof connection.token!=='string')return {...fail('余额连接与已确认站点不一致，请重新配置','API_ORIGIN_CHANGED'),clearPrevious:true};
  const accountKey=createHash('sha256').update(endpoint.href+'\0'+connection.token).digest('hex');
  const finish=data=>({...data,accountKey,clearPrevious:false});
  try{
    onAccount(accountKey);
    const response=await fetchImpl(endpoint.href,{method:'GET',headers:{Authorization:'Bearer '+connection.token,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(timeoutMs)});
    if(!response.ok){
      const code=response.status===401 || response.status===403?'API_AUTH_FAILED':response.status===429?'API_RATE_LIMITED':'API_HTTP_ERROR';
      const message=code==='API_AUTH_FAILED'?'余额查询认证失败':code==='API_RATE_LIMITED'?'余额查询过于频繁，请稍后刷新':'余额接口暂不可用，请稍后刷新';
      return finish(fail(message,code));
    }
    const length=Number(response.headers.get('content-length'));
    if(length>1024*1024)return finish(fail('余额接口响应过大','API_INVALID_RESPONSE'));
    const reader=response.body.getReader();
    let size=0;const chunks=[];
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1024*1024){await reader.cancel();return finish(fail('余额接口响应过大','API_INVALID_RESPONSE'));}chunks.push(Buffer.from(value));}
    let data;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return finish(fail('余额接口返回格式异常','API_INVALID_RESPONSE'));}
    return finish(connection.origin===ORIGIN?normalizePortdanUsage(data,now()):normalizeConfiguredUsage(data,connection.adapter,now()));
  }catch(error){
    const timedOut=error?.name==='TimeoutError' || error?.name==='AbortError';
    return finish(fail(timedOut?'余额查询超时，请稍后刷新':'余额查询连接失败，请稍后刷新',timedOut?'API_TIMEOUT':'API_NETWORK_ERROR'));
  }
}

export async function readApiBalance(options={}){
  let connection;
  try{connection=options.connection ?? readConnection();}
  catch(error){
    const unsupported=error.message==='API_PROVIDER_UNSUPPORTED';
    return {...fail(unsupported?'该中转站尚未配置余额接口':'余额查询配置不可用，请检查当前提供商和凭据',unsupported?'API_PROVIDER_UNSUPPORTED':'API_CONFIG_UNAVAILABLE'),clearPrevious:true};
  }
  return queryPortdanBalance(connection,options);
}
