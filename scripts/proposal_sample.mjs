import { createProposalTemplate } from './dist/schema/index.js';
import { canonicalize, computeProposalHash } from './dist/canonicalization/Canonicalizer.js';

function sample(n, outPath) {
  const fs = await import('fs');
  const lines = [];
  for (let i=0;i<n;i++){
    const p = createProposalTemplate('sample-agent', `session-sample-${i}`);
    const canonical = canonicalize(p);
    const hash = computeProposalHash(p);
    const obj = {iteration:i, proposal_id:p.proposal_id, session_id:p.session_id, timestamp:p.timestamp, canonical, hash};
    lines.push(JSON.stringify(obj));
  }
  fs.writeFileSync(outPath, lines.join('\n'));
}

(async ()=>{
  const args = process.argv.slice(2);
  const n = Number(args[0]||20);
  const out = args[1]||'/tmp/proposals.jsonl';
  await sample(n,out);
})();
