import {readApiBalance,readConnection} from './api-balance.mjs';
import {readUsage,resolveCodexExecutable} from './usage.mjs';

export function readConfiguredUsage(config,options={}){
  if(config.apiBalance?.enabled===true)return readApiBalance(options);
  if(config.apiBalance?.enabled!==false){
    let connection;
    try{connection=readConnection();}catch{/* Keep the official subscription path available. */}
    if(connection)return readApiBalance({...options,connection});
  }
  return readUsage(resolveCodexExecutable(config.codexPath),options);
}
