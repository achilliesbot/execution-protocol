import path from 'path';
const base = path.resolve('./dist');
const genPath = path.join(base,'execution','ExecutionPlanGenerator.js');
const policyPath = path.join(base,'policy','index.js');
const schemaPath = path.join(base,'schema','index.js');

const { generateExecutionPlan } = await import('file://'+genPath);
const policy = await import('file://'+policyPath);
const schema = await import('file://'+schemaPath);

const policySet = policy.createPhase1PolicySet ? policy.createPhase1PolicySet() : {id:'phase1'};

for(let i=200;i<202;i++){
  const proposal = schema.createProposalTemplate ? schema.createProposalTemplate('test-agent', `test-session-${i}`) : {proposal_id:'prop'+i, expiry:new Date(Date.now()+3600000).toISOString(), intent:{action:'swap', asset_in:{symbol:'USDC'}, asset_out:{symbol:'ETH'}, amount:{value:50}}, constraints:{slippage_tolerance_percent:1}, agent_id:'test-agent', session_id:`session-${i}`, timestamp:new Date().toISOString()};
  const res = generateExecutionPlan(proposal, policySet, {timestamp:new Date().toISOString(), portfolio:{total_value_usd:200, available_capital_usd:200, allocated_capital_usd:0, positions:[]}, market:{asset_prices:{USDC:1,ETH:3000}, network_congestion:'low'}, system:{}});
  console.log(JSON.stringify({iteration:i, error: res.error || null}, null, 2));
}
