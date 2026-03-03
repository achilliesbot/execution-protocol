import { generateExecutionPlan } from '../dist/execution/ExecutionPlanGenerator.js';
import * as policy from '../dist/policy/index.js';
import * as schema from '../dist/schema/index.js';

const policySet = policy.createPhase1PolicySet ? policy.createPhase1PolicySet() : {id:'phase1'};

for (let i=100;i<=101;i++){
  let proposal = schema.createProposalTemplate ? schema.createProposalTemplate('test-agent', `test-session-${i}`) : null;
  if(!proposal){
    proposal = { proposal_id: 'prop_'+i, expiry: new Date(Date.now()+3600000).toISOString(), intent: { action: 'swap', asset_in:{symbol:'USDC'}, asset_out:{symbol:'ETH'}, amount:{value:50}}, constraints:{slippage_tolerance_percent:1}, agent_id:'test-agent', session_id:'session-'+i, timestamp: new Date().toISOString() };
  }
  const res = generateExecutionPlan(proposal, policySet, {timestamp:new Date().toISOString(), portfolio:{}, market:{asset_prices:{USDC:1,ETH:3000}}, system:{}});
  console.log('=== ITER', i, 'RAW_PLAN ===');
  console.log(JSON.stringify(res.plan, null, 2));
}
