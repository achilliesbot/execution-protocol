/**
 * Execution Protocol v2 - Phase 1
 * Deterministic Execution Middleware for AI Agent Swarms
 *
 * Entry Point: Run simulated session with full determinism
 */
import { DeterministicSession } from './session/DeterministicSession.js';
console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║           EXECUTION PROTOCOL v2 - PHASE 1                        ║
║           Deterministic Execution Middleware                     ║
║           Status: SIMULATION MODE (Zero Loss Target)              ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
`);
// Phase 1 Configuration
const config = {
    sessionId: `ep_${Date.now()}`,
    workflowId: 'WF_SIMULATED_TRADING_001',
    initialCapital: 100, // $100 USDC from Bankr
    maxLossPercent: 0.02, // 2% max loss (conservative)
    approvalRequired: true,
    simulationMode: true // Phase 1: ALWAYS simulated
};
console.log('[Main] Phase 1 Configuration:');
console.log(`  - Session: ${config.sessionId}`);
console.log(`  - Capital: $${config.initialCapital} (MOCK)`);
console.log(`  - Max Loss: ${config.maxLossPercent * 100}%`);
console.log(`  - Mode: ${config.simulationMode ? 'SIMULATION' : 'LIVE'}`);
console.log('');
// Run session
async function main() {
    const session = new DeterministicSession(config);
    try {
        const finalState = await session.execute();
        console.log('\n═══════════════════════════════════════════════════════');
        console.log('  SESSION COMPLETE');
        console.log('═══════════════════════════════════════════════════════');
        console.log(`  Status: ${finalState.status}`);
        console.log(`  Steps: ${finalState.currentStep}`);
        console.log(`  P&L: $${finalState.pnl.toFixed(2)}`);
        console.log(`  Transcript Hash: ${finalState.hash}`);
        console.log('═══════════════════════════════════════════════════════\n');
        // Phase 1 verification
        if (finalState.pnl >= 0) {
            console.log('✅ Phase 1 constraint satisfied: Zero loss');
        }
        else {
            console.log('❌ Phase 1 constraint violated: Loss detected');
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('❌ Session failed:', errorMessage);
        process.exit(1);
    }
}
main();
