/** Hosted Studionet NORMAL/5-validator receipt verifier, including honest dissent.
 * This is evidence validation, not an alternative implementation of chain consensus.
 */
type Obj=Record<string,any>;
function object(x:any):Obj {if(!x||typeof x!=='object'||Array.isArray(x))throw Error('Malformed receipt');return x;}
function address(x:any):string {if(typeof x!=='string'||!/^0x[0-9a-fA-F]{40}$/.test(x))throw Error('Validator identity');return x.toLowerCase();}
export function validateStudioConsensus(tx:Obj){
 if(tx.status!=='FINALIZED'||tx.result_name!=='MAJORITY_AGREE'||tx.result!==6)throw Error('No final majority');
 if(tx.leader_only!==false||tx.execution_mode!=='NORMAL'||tx.num_of_initial_validators!==5)throw Error('Wrong consensus configuration');
 const c=object(tx.consensus_data),votes=new Map<string,string>();
 for(const [a,v] of Object.entries(object(c.votes))){const key=address(a);if(votes.has(key)||!['agree','disagree','idle'].includes(String(v)))throw Error('Invalid voting set');votes.set(key,String(v));}
 if(votes.size!==5||!Array.isArray(c.leader_receipt)||!Array.isArray(c.validators)||c.validators.length!==4)throw Error('Incomplete receipts');
 const leaders=c.leader_receipt.filter((r:Obj)=>r.mode==='leader');
 if(leaders.length!==1||c.leader_receipt.length!==2)throw Error('Missing or ambiguous leader');
 const leader=leaders[0],leaderAddress=address(object(leader.node_config).address);
 if(leader.execution_result!=='SUCCESS'||!votes.has(leaderAddress))throw Error('Leader execution failure');
 const self=c.leader_receipt.filter((r:Obj)=>r!==leader);
 if(self.length!==1||address(object(self[0].node_config).address)!==leaderAddress)throw Error('Missing self-check');
 const seen=new Set<string>();let agree=0,disagree=0,idle=0,independentAgree=0;
 for(const r of [...self,...c.validators]){
  const a=address(object(r.node_config).address);
  if(seen.has(a)||r.mode!=='validator'||votes.get(a)!==r.vote)throw Error('Vote/identity mismatch');seen.add(a);
  if(r.vote==='idle'){
   if(r.execution_result!=='ERROR'||object(r.genvm_result).error_code!=='CONSENSUS_VALIDATOR_QUORUM_REACHED')throw Error('Unexplained idle/error');idle++;
  }else{
   if(r.execution_result!=='SUCCESS')throw Error('Validator execution failure');
   if(r.vote==='agree'){agree++;if(a!==leaderAddress)independentAgree++;}else if(r.vote==='disagree'){disagree++;}else throw Error('Unknown vote');
  }
 }
 if(seen.size!==5||agree<3)throw Error('Insufficient majority');
 return {agree,disagree,idle,total:5,independentAgree,leaderAddress,unanimous:agree===5};
}
