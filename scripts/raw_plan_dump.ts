import { createPhase1PolicySet } from './src/policy/index';
import { createProposalTemplate } from './src/schema/index';
import { generateExecutionPlan } from './src/execution/index';

async function main(){
  const policySet = createPhase1PolicySet();
  const results: any[] = [];
  for(let i=0;i<500;i++){
    const proposal = createProposalTemplate('test-agent', `test-session-${i}`);
    const stateSnapshot = {
      timestamp: new Date().toISOString(),
      portfolio: { total_value_usd: 200, available_capital_usd: 200, allocated_capital_usd: 0, positions: [] },
      market: { asset_prices: { USDC: 1, ETH: 3000 }, network_congestion: 'low' },
      system: { daily_trade_count: 0, daily_volume_usd: 0 }
    };
    const res = generateExecutionPlan(proposal as any, policySet as any, stateSnapshot as any);
    // capture the raw plan object (may be null)
    if(i===100 || i===101){
      console.log('=== ITER', i, 'RAW_PLAN ===');
      console.log(JSON.stringify(res.plan, null, 2));
    }
  }
}

main().catch(e=>{console.error(e); process.exit(1)});
