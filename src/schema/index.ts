/**
 * Schema Module — Execution Protocol v2
 * 
 * Canonical boundary object definitions
 * GOVERNANCE.md §1: Separation of probabilistic and deterministic layers
 */

export {
  OpportunityProposal,
  ExecutionDomain,
  OpportunityType,
  Intent,
  Asset,
  RiskBudget,
  ExecutionConstraints,
  ReasoningReceipt,
  validateProposalStructure,
  createProposalTemplate
} from './OpportunityProposal';

// ExecutionPlan.v1 will be exported here once built
// It is derived from Proposal + Policy + State (LLM never generates directly)