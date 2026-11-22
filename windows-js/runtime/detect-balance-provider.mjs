import {readConnection} from './api-balance.mjs';

export function detectBalanceProvider(env=process.env){
  try{
    const {origin}=readConnection(env);
    return {status:'supported',origin};
  }catch(error){
    switch(error.message){
      case 'API_OFFICIAL': return {status:'official'};
      case 'API_PROVIDER_UNSUPPORTED': return {status:'unsupported',origin:error.origin};
      case 'API_CREDENTIAL_UNAVAILABLE': return {status:'credentials',origin:error.origin};
      default: return {status:error.code==='ENOENT'?'missing':'unavailable'};
    }
  }
}
