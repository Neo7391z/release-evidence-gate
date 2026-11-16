import test from 'node:test';import assert from 'node:assert/strict';
import {validateStudioConsensus} from '../scripts/studio-consensus.ts';
const addr=n=>'0x'+n.toString(16).padStart(40,'0');
function fixture(votes=['disagree','agree','agree','agree','disagree']){const receipt=(i)=>({mode:'validator',vote:votes[i],execution_result:votes[i]==='idle'?'ERROR':'SUCCESS',node_config:{address:addr(i+1)},genvm_result:{error_code:votes[i]==='idle'?'CONSENSUS_VALIDATOR_QUORUM_REACHED':null}});return {status:'FINALIZED',result_name:'MAJORITY_AGREE',result:6,leader_only:false,execution_mode:'NORMAL',num_of_initial_validators:5,consensus_data:{votes:Object.fromEntries(votes.map((v,i)=>[addr(i+1),v])),leader_receipt:[{mode:'leader',execution_result:'SUCCESS',node_config:{address:addr(1)}},receipt(0)],validators:[1,2,3,4].map(receipt)}};}
test('successful majority preserves dissent',()=>{const r=validateStudioConsensus(fixture());assert.equal(r.agree,3);assert.equal(r.disagree,2);assert.equal(r.independentAgree,3);assert.equal(r.unanimous,false)});
test('quorum cancellation is not dissent or agreement',()=>{const r=validateStudioConsensus(fixture(['agree','agree','agree','idle','idle']));assert.equal(r.idle,2);assert.equal(r.disagree,0)});
test('unanimity only if all five agree',()=>assert.equal(validateStudioConsensus(fixture(Array(5).fill('agree'))).unanimous,true));
for(const [name,mutate] of Object.entries({
 'nonfinal':x=>x.status='ACCEPTED',
 'failed leader':x=>x.consensus_data.leader_receipt[0].execution_result='ERROR',
 'failed validator':x=>x.consensus_data.validators[0].execution_result='ERROR',
 'duplicate validator':x=>x.consensus_data.validators[1].node_config.address=addr(2),
 'missing receipt':x=>x.consensus_data.validators.pop(),
 'leader only':x=>x.leader_only=true,
 'vote mismatch':x=>x.consensus_data.validators[0].vote='disagree',
 'unexplained idle':x=>{let r=x.consensus_data.validators[0];r.vote='idle';r.execution_result='ERROR';x.consensus_data.votes[addr(2)]='idle';},
 'invalid result':x=>x.result=0,
 'missing identity':x=>delete x.consensus_data.validators[0].node_config.address,
}))test('reject '+name,()=>{const x=fixture();mutate(x);assert.throws(()=>validateStudioConsensus(x));});
test('reject minority agreement',()=>assert.throws(()=>validateStudioConsensus(fixture(['disagree','agree','agree','disagree','disagree']))));
