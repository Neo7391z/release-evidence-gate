import json
import pytest
CRITERIA=['CSV export preserves Unicode.','Cancelled exports create no download.']
TEXT='CSV export preserved café and 東京. Cancelled export produced no download.'
DOCS=[{'source':'https://example.org/synthetic-test','text':TEXT}]
def result(a='MET',b='MET'):
    return {'items':[{'index':i,'verdict':v,'evidence_index':0,'quote':TEXT} for i,v in enumerate([a,b])]}
@pytest.fixture
def gate(direct_vm,direct_deploy,direct_alice):
    direct_vm.sender=direct_alice
    return direct_deploy('contracts/release_gate.py',json.dumps(CRITERIA),sdk_version='v0.3.0-rc7')
def run(c,vm,id='v1',parent='',rev=0,a='MET',b='MET'):
    vm.clear_mocks();vm.mock_llm('.*RELEASE AUDIT.*',json.dumps(result(a,b)))
    c.audit(id,parent,rev,json.dumps(DOCS));return json.loads(c.get_release(id))
@pytest.mark.parametrize('a,b,status',[('MET','MET','DOCUMENTED'),('MET','UNCERTAIN','REVIEW_REQUIRED'),('UNCERTAIN','NOT_MET','BLOCKED')])
def test_status(gate,direct_vm,a,b,status):assert run(gate,direct_vm,a=a,b=b)['status']==status

def test_regression_chain(gate,direct_vm):
    run(gate,direct_vm);r=run(gate,direct_vm,'v2','v1',1,'MET','NOT_MET')
    assert r['regressions']==[1] and r['parent']=='v1'
    assert json.loads(gate.get_ledger())['revision']==2

def test_owner(gate,direct_vm,direct_bob):
    direct_vm.sender=direct_bob
    with pytest.raises(Exception,match='Maintainer only'):gate.audit('v1','',0,json.dumps(DOCS))
@pytest.mark.parametrize('id,parent,rev,error',[('V1','',0,'Invalid release id'),('v1','x',0,'Wrong parent'),('v1','',1,'Stale revision')])
def test_preconditions(gate,id,parent,rev,error):
    with pytest.raises(Exception,match=error):gate.audit(id,parent,rev,json.dumps(DOCS))

def test_immutable(gate,direct_vm):
    run(gate,direct_vm)
    with pytest.raises(Exception,match='Immutable release'):gate.audit('v1','v1',1,json.dumps(DOCS))
@pytest.mark.parametrize('docs,error',[(DOCS*2,'Duplicate evidence'),([], 'Require 1-4'),([{'source':'http://x','text':TEXT}],'HTTPS source'),([{'source':'https://x','text':''}],'Invalid evidence')])
def test_document_bounds(gate,docs,error):
    with pytest.raises(Exception,match=error):gate.audit('v1','',0,json.dumps(docs))

def test_validator_independence(gate,direct_vm):
    run(gate,direct_vm)
    assert direct_vm.run_validator() is True
    direct_vm.clear_mocks();direct_vm.mock_llm('.*RELEASE AUDIT.*',json.dumps(result('UNCERTAIN')))
    assert direct_vm.run_validator() is False
    assert direct_vm.run_validator(leader_error=Exception('fail')) is False
@pytest.mark.parametrize('mutation',['quote','index','verdict','extra','bool'])
def test_forged_leader(gate,direct_vm,mutation):
    run(gate,direct_vm);r=result()
    if mutation=='quote':r['items'][0]['quote']='not in evidence'
    elif mutation=='index':r['items'][0]['index']=1
    elif mutation=='bool':r['items'][0]['index']=False
    elif mutation=='extra':r['extra']='injection'
    else:r['items'][0]['verdict']='APPROVED'
    assert direct_vm.run_validator(leader_result=r) is False

def test_missing(gate):assert gate.get_release('missing')=='{}'
@pytest.mark.parametrize('criteria',[[],['']*2,['a']*2,['a']*5])
def test_criteria_bounds(direct_deploy,criteria):
    with pytest.raises(Exception):direct_deploy('contracts/release_gate.py',json.dumps(criteria),sdk_version='v0.3.0-rc7')
