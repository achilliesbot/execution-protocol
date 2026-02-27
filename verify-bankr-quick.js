/**
 * Quick Bnkr Verification — Phase 2 GO Check
 */

const BNKR_API_KEY = process.env.BNKR_API_KEY;
const BNKR_URL = 'https://api.bankr.bot';

async function quickVerify() {
  console.log('🔍 Bnkr.bot Quick Verification\n');
  
  if (!BNKR_API_KEY) {
    console.error('❌ BNKR_API_KEY missing');
    process.exit(1);
  }

  try {
    // Quick connectivity test
    console.log('1️⃣ API connectivity...');
    const jobRes = await fetch(`${BNKR_URL}/agent/prompt`, {
      method: 'POST',
      headers: { 'X-API-Key': BNKR_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'ping' })
    });
    
    if (!jobRes.ok) throw new Error(`HTTP ${jobRes.status}`);
    const job = await jobRes.json();
    console.log(`   ✅ API responsive (job: ${job.jobId?.slice(0, 12)}...)`);

    // Check specific tokens via quote request
    console.log('\n2️⃣ Checking $BNKR, $CLAWD, $BNKRW...');
    const tokens = ['BNKR', 'CLAWD', 'BNKRW'];
    const results = {};
    
    for (const token of tokens) {
      try {
        const quoteRes = await fetch(`${BNKR_URL}/agent/prompt`, {
          method: 'POST',
          headers: { 'X-API-Key': BNKR_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            prompt: `Can I trade $${token}? Reply YES or NO only.` 
          })
        });
        
        if (quoteRes.ok) {
          const qJob = await quoteRes.json();
          // Quick poll once
          await new Promise(r => setTimeout(r, 3000));
          const pollRes = await fetch(`${BNKR_URL}/agent/job/${qJob.jobId}`, {
            headers: { 'X-API-Key': BNKR_API_KEY }
          });
          const poll = await pollRes.json();
          
          const resp = (poll.response || '').toUpperCase();
          results[token] = resp.includes('YES') || !resp.includes('NO');
          console.log(`   ${results[token] ? '✅' : '⚠️'} $${token}: ${resp.slice(0, 30) || 'checking...'}`);
        } else {
          results[token] = false;
          console.log(`   ⚠️ $${token}: API error ${quoteRes.status}`);
        }
      } catch (e) {
        results[token] = false;
        console.log(`   ⚠️ $${token}: ${e.message}`);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(40));
    const allYes = tokens.every(t => results[t]);
    
    if (allYes) {
      console.log('✅ ALL TOKENS TRADEABLE');
      console.log('   Ready for Phase 2 DRY-RUN GO');
    } else {
      console.log('⚠️  PARTIAL — Some tokens need verification');
      tokens.forEach(t => console.log(`   ${results[t] ? '✅' : '❌'} $${t}`));
    }
    
    return allYes;
    
  } catch (error) {
    console.error('\n❌ Failed:', error.message);
    process.exit(1);
  }
}

quickVerify().then(ok => process.exit(ok ? 0 : 1));
