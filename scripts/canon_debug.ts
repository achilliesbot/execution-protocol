import { canonicalize } from '../src/canonicalization/Canonicalizer';
import { createProposalTemplate } from '../src/schema/index';

const p = createProposalTemplate('dbg','sess');
console.log('ABOUT TO CANONICALIZE');
console.log(canonicalize(p));
