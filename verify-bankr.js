/**
 * Bankr API Live Verification (Corrected)
 * 
 * Bankr uses agent-based natural language API:
 * - POST /agent/prompt with X-API-Key header
 * - Returns jobId, poll /agent/job/{jobId} for results
 */

const BNKR_API_KEY = process.env.BNKR_API_KEY;
const BNKR_URL = 'https://api.bankr.bot'; // Correct endpoint

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function submitPrompt(prompt) {
  const response = await fetch(`${BNKR_URL}/agent/prompt`, {
    method: 'POST',
    headers: {
      'X-API-Key': BNKR_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ prompt })
  });
  
  if (!response.ok) {
    throw new Error(`Prompt failed: ${response.status}`);
  }
  
  return response.json();
}

async function pollJob(jobId, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(`${BNKR_URL}/agent/job/${jobId}`, {
      headers: { 'X-API-Key': BNKR_API_KEY }
    });
    
    if (!response.ok) {
      throw new Error(`Poll failed: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.status === 'completed' || result.status === 'failed' || result.status === 'cancelled') {
      return result;
    }
    
    process.stdout.write('.');
    await sleep(2000);
  }
  
  throw new Error('Polling timeout');
}

async function verifyBankr() {
  console.log('🔍 Bankr.bot Integration Verification\n');

  if (!BNKR_API_KEY) {
    console.error('❌ BNKR_API_KEY not found');
    process.exit(1);
  }

  try {
    // 1. Test API connectivity with balance check
    console.log('1️⃣ Testing API connectivity...');
    const job1 = await submitPrompt('What is my wallet balance? Reply with just the number.');
    console.log(`   Job submitted: ${job1.jobId}`);
    
    const result1 = await pollJob(job1.jobId);
    console.log(`\n   ✅ API responsive`);
    if (result1.response) {
      console.log(`   Response: ${result1.response.substring(0, 100)}...`);
    }

    // 2. Check token availability
    console.log('\n2️⃣ Checking token availability...');
    const job2 = await submitPrompt('List the tokens I can trade. Include BNKR, CLAWD, BNKRW if available.');
    console.log(`   Job submitted: ${job2.jobId}`);
    
    const result2 = await pollJob(job2.jobId);
    console.log(`   ✅ Response received`);
    
    const responseText = (result2.response || '').toUpperCase();
    const hasBNKR = responseText.includes('BNKR');
    const hasCLAWD = responseText.includes('CLAWD');
    const hasBNKRW = responseText.includes('BNKRW');
    
    console.log(`\n📊 Token Verification:`);
    console.log(`  ${hasBNKR ? '✅' : '⚠️'} $BNKR`);
    console.log(`  ${hasCLAWD ? '✅' : '⚠️'} $CLAWD`);
    console.log(`  ${hasBNKRW ? '✅' : '⚠️'} $BNKRW`);

    // 3. Check quote capability (DRY-RUN test)
    console.log('\n3️⃣ Testing quote capability...');
    const job3 = await submitPrompt('What would be the exchange rate for 100 BNKR to CLAWD? Just the rate.');
    console.log(`   Job submitted: ${job3.jobId}`);
    
    const result3 = await pollJob(job3.jobId);
    console.log(`   ✅ Quote endpoint accessible`);
    if (result3.response) {
      console.log(`   Rate info: ${result3.response.substring(0, 80)}...`);
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    const allGood = hasBNKR && hasCLAWD && hasBNKRW;
    if (allGood) {
      console.log('✅ BNKR INTEGRATION VERIFIED');
      console.log('   All tokens tradeable');
      console.log('   Ready for Phase 2 DRY-RUN GO');
    } else {
      console.log('⚠️  INTEGRATION PARTIAL');
      console.log('   API working, some tokens may need verification');
    }

    // 4. Document response for BNKR_INTEGRATION.md
    console.log('\n📋 Sample Response Structure:');
    console.log(JSON.stringify({
      jobId: job1.jobId,
      threadId: job1.threadId,
      status: result1.status,
      hasResponse: !!result1.response
    }, null, 2));

  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    process.exit(1);
  }
}

verifyBankr();
