// Free hosted Studionet only. Synthetic governance proposals; never money or a user wallet.
import {abi,createAccount,generatePrivateKey,createClient} from 'genlayer-js';
import {studionet} from 'genlayer-js/chains';
import {TransactionHashVariant} from 'genlayer-js/types';
import {encodeFunctionData,zeroAddress,keccak256} from 'viem';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validateStudioConsensus} from './studio-consensus.ts';
const endpoint='https://studio.genlayer.com/api', chainId=61999;
const root=new URL('../',import.meta.url);
const sha=x=>createHash('sha256').update(x).digest('hex');
const criteria=['CSV export preserves Unicode.','Cancelled exports create no download.'];
if(!process.argv.includes('--authorized-studionet-only')) {console.log('PLAN: isolated disposable signer, free chain 61999, deploy and resolve synthetic governance proposals. Execute with --authorized-studionet-only.');process.exit(0);}
let id=0;
async function rpc(method,params=[]){const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:++id,method,params}),signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error('RPC HTTP '+r.status); const j=await r.json(); if(j.error)throw Error(JSON.stringify(j.error));return j.result;}
async function safety(){if(await rpc('eth_chainId')!=='0xf22f'||await rpc('net_version')!=='61999'||await rpc('eth_gasPrice')!=='0x0'||studionet.id!==chainId)throw Error('Not free Studionet');}
await safety();
await mkdir(new URL('.local/',root),{recursive:true,mode:0o700});await mkdir(new URL('evidence/',root),{recursive:true});
const save=async(name,x)=>writeFile(new URL(name,root),JSON.stringify(x,null,2)+'\n');
const read=async(name)=>{try{return JSON.parse(await readFile(new URL(name,root),'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}};
let key=await read('.local/signer.json');if(!key){key={privateKey:generatePrivateKey()};await writeFile(new URL('.local/signer.json',root),JSON.stringify(key),{mode:0o600,flag:'wx'});}
const account=createAccount(key.privateKey), client=createClient({chain:studionet,endpoint});
const source=await readFile(new URL('contracts/release_gate.py',root),'utf8');
async function send(name,to,method,args){
 const old=await read('.local/'+name+'.json');let hash;
 if(old){
  if(old.sourceSha256!==sha(source))throw Error('Source changed');
  if(!old.hash){
   const recovered=await rpc('eth_getTransactionByHash',[old.rawHash]);
   if(!recovered||recovered.hash!==old.rawHash||recovered.from_address.toLowerCase()!==account.address.toLowerCase()||(method&&recovered.to_address.toLowerCase()!==to.toLowerCase()))throw Error('Uncertain prior submission; inspect, do not retry');
   old.hash=old.rawHash;old.status='RECOVERED_BY_READ';await save('.local/'+name+'.json',old);
  }
  hash=old.hash;
 }
 else{
 await safety();
 const call=abi.calldata.encode(abi.calldata.makeCalldataObject(method,args,undefined));
 const payload=abi.transactions.serialize(method?[call,false]:[source,call,false]);
 const target=studionet.consensusMainContract.address;
 const data=encodeFunctionData({abi:studionet.consensusMainContract.abi,functionName:'addTransaction',args:[account.address,to,5n,3n,payload]});
 const gas=BigInt(await rpc('eth_estimateGas',[{from:account.address,to:target,data,value:'0x0',gasPrice:'0x0'}]));if(gas<=0n||gas>5000000n)throw Error('Gas estimate');
 const nonce=Number(BigInt(await rpc('eth_getTransactionCount',[account.address,'latest'])));
 const signed=await account.signTransaction({to:target,data,value:0n,gasPrice:0n,gas,nonce,chainId,type:'legacy'});
 const pending={name,sourceSha256:sha(source),rawHash:keccak256(signed),status:'SUBMITTING'};
 await writeFile(new URL('.local/'+name+'.json',root),JSON.stringify(pending),{flag:'wx',mode:0o600});
 hash=await rpc('eth_sendRawTransaction',[signed]);await save('.local/'+name+'.json',{...pending,hash,status:'SUBMITTED'});
 }
 console.log(name,hash);const deadline=Date.now()+300000;let tx;
 while(Date.now()<deadline){tx=await rpc('eth_getTransactionByHash',[hash]);if(tx?.status==='FINALIZED')break;if(['CANCELED','REJECTED','UNDETERMINED'].includes(tx?.status))throw Error('Terminal '+tx.status);await new Promise(r=>setTimeout(r,2000));}
 const consensus=validateStudioConsensus(tx);
 const receipt=r=>({mode:r.mode,vote:r.vote,execution_result:r.execution_result,node_config:{address:r.node_config.address},genvm_result:{error_code:r.genvm_result?.error_code}});
 const transaction={hash:tx.hash,from_address:tx.from_address,to_address:tx.to_address,status:tx.status,result:tx.result,result_name:tx.result_name,leader_only:tx.leader_only,execution_mode:tx.execution_mode,num_of_initial_validators:tx.num_of_initial_validators,consensus_data:{votes:tx.consensus_data.votes,leader_receipt:tx.consensus_data.leader_receipt.map(receipt),validators:tx.consensus_data.validators.map(receipt)}};
 await save('evidence/'+name+'.json',{hash,sourceSha256:sha(source),consensus,transaction,receiptProjection:'Only fields required for verification; query public RPC for full receipt'});return tx;
}

const deployed=await send('deploy',zeroAddress,undefined,[JSON.stringify(criteria)]);const address=deployed.to_address;
if(sha(await client.getContractCode(address))!==sha(source))throw Error('Source mismatch');
const view=async(name,args=[])=>client.readContract({address,functionName:name,args,transactionHashVariant:TransactionHashVariant.LATEST_FINAL});
const cases=[['v1','','CSV export preserved café and 東京 in all cells of a roundtrip. Cancelling an export before completion produced no download.','DOCUMENTED'],['v2','v1','CSV export preserved café and 東京. BUG: cancelling an export still generated a downloaded CSV file.','BLOCKED']];
for(let i=0;i<cases.length;i++){const [id,parent,text,expected]=cases[i];await send(id,address,'audit',[id,parent,i,JSON.stringify([{source:'https://example.org/synthetic-release-test',text}])]);const record=JSON.parse(await view('get_release',[id]));await save('evidence/'+id+'-record.json',record);if(record.status!==expected)throw Error('Unexpected '+record.status);}
const deployment={network:'Hosted Studionet simulator (not production validator network)',chainId,address,owner:account.address,sourceSha256:sha(source),ledger:JSON.parse(await view('get_ledger')),validatedAt:new Date().toISOString(),studio:'https://studio.genlayer.com/?import-contract='+address};
await save('evidence/deployment.json',deployment);await save('web/deployment.json',deployment);
console.log('Verified two release audits',address);
