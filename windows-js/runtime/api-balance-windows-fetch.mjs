import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';

export function windowsFetch(url,options){
  if(!URL.canParse(url) || new URL(url).protocol!=='https:' || options.method!=='GET' || options.redirect!=='error')return Promise.reject(new Error('Unsupported balance request'));
  const script=fileURLToPath(new URL('./api-balance-http.ps1',import.meta.url));
  const executable=path.join(process.env.SystemRoot || 'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
  return new Promise((resolve,reject)=>{
    let settled=false,output='',size=0;
    const child=spawn(executable,['-NoProfile','-NonInteractive','-File',script],{windowsHide:true,stdio:['pipe','pipe','pipe']});
    const finish=(error,result)=>{if(settled)return;settled=true;clearTimeout(timer);options.signal?.removeEventListener('abort',abort);child.kill();error?reject(error):resolve(result);};
    const abort=()=>{const error=new Error('Balance request timed out');error.name='TimeoutError';finish(error);};
    const timer=setTimeout(abort,20000);
    options.signal?.addEventListener('abort',abort,{once:true});
    if(options.signal?.aborted){abort();return;}
    child.on('error',()=>finish(new Error('Windows balance transport unavailable')));
    child.stdin.on('error',()=>finish(new Error('Windows balance transport unavailable')));
    child.stderr.on('data',()=>{});
    child.stdout.setEncoding('utf8');
    child.stdout.on('data',text=>{size+=Buffer.byteLength(text);if(size>3*1024*1024)finish(new Error('Balance response too large'));else output+=text;});
    child.on('close',()=>{
      if(settled)return;
      try{
        const result=JSON.parse(output.replace(/^\uFEFF/,''));
        if(result.networkError || !Number.isInteger(result.status))throw new Error();
        if(result.status>=300 && result.status<400)throw new Error();
        finish(null,new Response(result.body,{status:result.status}));
      }catch{finish(new Error('Windows balance transport failed'));}
    });
    child.stdin.end(JSON.stringify({url,token:options.headers.Authorization.slice(7),timeoutMs:18000}));
  });
}
