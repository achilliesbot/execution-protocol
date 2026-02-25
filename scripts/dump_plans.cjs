const exec = require('../dist/execution/ExecutionPlanGenerator.js');
const policy = require('../dist/policy/index.js');

const createProposal = require('../dist/schema/index.js').createProposalTemplate || (name=>null);

const policySet = (policy.createPhase1PolicySet) ? policy.createPhase1PolicySet() : {id:'phase1'};

for(let i=100;i<=101;i++){
  const proposal = require('../dist/schema/OpportunityProposal.js') && require('../dist/schema/OpportunityProposal.js').createProposalTemplate ? require('../dist/schema/OpportunityProposal.js').createProposalTemplate('test-agent', 'test-session') : createProposal('test-agent','test-session');
  if(!proposal) {
    // fallback construct
    const p = { proposal_id: 'prop_'+i, expiry: new Date(Date.now()+3600000).toISOString(), intent: { action: 'swap', asset_in:{symbol:'USDC'}, asset_out:{symbol:'ETH'}, amount:{value:50}}, constraints:{slippage_tolerance_percent:1}, agent_id:'test-agent'};
    Object.assign(p,{session_id:'session-'+i, timestamp:new Date().toISOString()});
    // use p
    const res = exec.generateExecutionPlan(p, policySet, {timestamp:new Date().toISOString(), portfolio:{}, market:{asset_prices:{USDC:1,ETH:3000}}, system:{}});
    console.log('=== ITER',i,'RAW_PLAN ===');
    console.log(JSON.stringify(res.plan, null, 2));
  } else {
    const res = exec.generateExecutionPlan(proposal, policySet, {timestamp:new Date().toISOString(), portfolio:{}, market:{asset_prices:{USDC:1,ETH:3000}}, system:{}});
    console.log('=== ITER',i,'RAW_PLAN ===');
    console.log(JSON.stringify(res.plan, null, 2));
  }
}
