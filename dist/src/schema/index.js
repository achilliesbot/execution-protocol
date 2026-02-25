"use strict";
/**
 * Schema Module — Execution Protocol v2
 *
 * Canonical boundary object definitions
 * GOVERNANCE.md §1: Separation of probabilistic and deterministic layers
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProposalTemplate = exports.validateProposalStructure = void 0;
var OpportunityProposal_1 = require("./OpportunityProposal");
Object.defineProperty(exports, "validateProposalStructure", { enumerable: true, get: function () { return OpportunityProposal_1.validateProposalStructure; } });
Object.defineProperty(exports, "createProposalTemplate", { enumerable: true, get: function () { return OpportunityProposal_1.createProposalTemplate; } });
// ExecutionPlan.v1 will be exported here once built
// It is derived from Proposal + Policy + State (LLM never generates directly)
