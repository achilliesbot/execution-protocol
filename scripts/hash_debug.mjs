import { createProposalTemplate } from './dist/schema/index.js';
import { canonicalize, computeProposalHash } from './dist/canonicalization/Canonicalizer.js';

function runBatch() {
  const outputs = [];
  for (let i=0;i<5;i++){
    const p = createProposalTemplate('debug-agent','session-debug');
    // intentionally let createProposalTemplate set timestamps/ids
    const canonical = canonicalize(p);
    const hash = computeProposalHash(p);
    outputs.push({i, proposal: p, canonical, hash});
  }
  console.log(JSON.stringify(outputs,null,2));
}

runBatch();
