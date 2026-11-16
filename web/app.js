import {validateStudioConsensus} from '../scripts/studio-consensus.ts';
import {createClient,createAccount,generatePrivateKey,abi} from 'genlayer-js';
import {encodeFunctionData,zeroAddress} from 'viem';
import {studionet} from 'genlayer-js/chains';
import {TransactionHashVariant} from 'genlayer-js/types';
const $=id=>document.getElementById(id);
const client=createClient({chain:studionet,endpoint:'https://studio.genlayer.com/api'});
let address;
const el=(tag,text,cls)=>{const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;};
async function read(fn,args=[],targetAddress=address){return JSON.parse(await client.readContract({address:targetAddress,functionName:fn,args,transactionHashVariant:TransactionHashVariant.LATEST_FINAL}));}
async function load(){
 $('refresh').disabled=true;$('criteria').replaceChildren();$('releases').replaceChildren();$('status').textContent='Reading finalized ledger from Studionet…';
 try {
  const config=await (await fetch('./deployment.json')).json();address=config.address;
  if(!/^0x[0-9a-fA-F]{40}$/.test(address))throw Error('Deployment is not available');
  $('address').textContent=address;
  const targetAddress=address;const ledger=await read('get_ledger',[],targetAddress);const criterionNodes=ledger.criteria.map((s,i)=>el('li',`${i+1}. ${s}`));const cards=[];
  $('releases').replaceChildren();
  for(const id of [...ledger.releases].reverse()){
   const r=await read('get_release',[id],targetAddress);const card=el('article','');card.append(el('span',r.status,'badge '+r.status),el('h2',r.id),el('p',`Parent: ${r.parent||'Genesis'} · Ledger revision ${r.revision}`,'muted'));
   if(r.regressions.length)card.append(el('p','Regression in criteria '+r.regressions.map(x=>x+1).join(', '),'warning'));
   for(const item of r.audit.items){const section=el('section','');section.append(el('h3',`${item.index+1}. ${r.criteria[item.index]}`),el('p',item.verdict,'verdict'),el('blockquote',item.quote));const doc=r.documents[item.evidence_index];section.append(el('p','Submitted source label: '+doc.source,'muted'),el('code','SHA-256 '+r.sha256[item.evidence_index]));card.append(section);}
   const detail=el('details','');detail.append(el('summary','Inspect complete on-chain record'),el('pre',JSON.stringify(r,null,2)));card.append(detail);cards.push(card);
  }
  $('criteria').replaceChildren(...criterionNodes);$('releases').replaceChildren(...cards);
  $('status').textContent=`Live read complete · ${ledger.releases.length} immutable releases · ${new Date().toLocaleTimeString()}`;
 }catch(e){$('status').textContent='Live read failed. No cached result is being shown. '+e.message;}finally{$('refresh').disabled=false;}
}
$('refresh').addEventListener('click',load);load();

let busy=false,rpcId=0;
async function rpc(method,params=[]){const response=await fetch('https://studio.genlayer.com/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:++rpcId,method,params}),signal:AbortSignal.timeout(60000)});if(!response.ok)throw Error('RPC HTTP '+response.status);const body=await response.json();if(body.error)throw Error(body.error.message);return body.result;}
async function safety(){if(await rpc('eth_chainId')!=='0xf22f'||await rpc('eth_gasPrice')!=='0x0')throw Error('Not zero-fee Studionet');}
async function execute(account,source,to,method,args){
 await safety();const call=abi.calldata.encode(abi.calldata.makeCalldataObject(method,args,undefined));const payload=abi.transactions.serialize(method?[call,false]:[source,call,false]);const target=studionet.consensusMainContract.address;
 const data=encodeFunctionData({abi:studionet.consensusMainContract.abi,functionName:'addTransaction',args:[account.address,to,5n,3n,payload]});
 const gas=BigInt(await rpc('eth_estimateGas',[{from:account.address,to:target,data,value:'0x0',gasPrice:'0x0'}]));if(gas<=0n||gas>5000000n)throw Error('Unexpected gas estimate');
 const nonce=Number(BigInt(await rpc('eth_getTransactionCount',[account.address,'latest'])));
 const signed=await account.signTransaction({to:target,data,value:0n,gasPrice:0n,gas,nonce,chainId:61999,type:'legacy'});
 $('runstatus').textContent='Submitting '+(method||'deployment')+' once. Do not close this page.';
 const hash=await rpc('eth_sendRawTransaction',[signed]);$('txhash').textContent='Submitted transaction: '+hash;
 const deadline=Date.now()+300000;
 while(Date.now()<deadline){const tx=await rpc('eth_getTransactionByHash',[hash]);$('runstatus').textContent=(method||'Deployment')+': '+(tx?.status||'waiting');
  if(tx?.status==='FINALIZED'){validateStudioConsensus(tx);return tx;}
  if(['CANCELED','REJECTED','UNDETERMINED'].includes(tx?.status))throw Error('Terminal transaction: '+tx.status);
  await new Promise(r=>setTimeout(r,2500));
 }
 throw Error('Still pending after five minutes. Transaction may complete later; do not blindly retry.');
}
$('run').addEventListener('click',async()=>{
 if(busy)return;busy=true;$('run').disabled=true;$('ownresult').textContent='';$('ownaddress').textContent='';$('txhash').textContent='';
 try{const text=$('evidence').value.trim();if(!text||text.length>2000)throw Error('Evidence must contain 1-2000 characters');await safety();const response=await fetch('./release_gate.py');if(!response.ok)throw Error('Source unavailable');const source=await response.text();const sourceHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(source)))).map(x=>x.toString(16).padStart(2,'0')).join('');const configResponse=await fetch('./deployment.json');if(!configResponse.ok)throw Error('Deployment configuration unavailable');const config=await configResponse.json();if(sourceHash!==config.sourceSha256)throw Error('Source checksum mismatch');const account=createAccount(generatePrivateKey());
 const deployed=await execute(account,source,zeroAddress,undefined,[JSON.stringify(['CSV export preserves Unicode.','Cancelled exports create no download.'])]);
 const own=deployed.to_address;$('ownaddress').textContent='Your isolated contract: '+own;

 await execute(account,source,own,'audit',['v1','',0,JSON.stringify([{source:'https://example.org/user-supplied-synthetic-test',text}])]);
 const result=await read('get_release',['v1'],own);$('ownresult').textContent=JSON.stringify(result,null,2);$('runstatus').textContent='Finalized. '+result.status+' is documentary support only, not proof of execution.';
 }catch(e){$('runstatus').textContent='Stopped: '+e.message+' No automatic transaction retry.';}finally{busy=false;$('run').disabled=false;}
});
