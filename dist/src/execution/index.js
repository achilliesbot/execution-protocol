"use strict";
/**
 * Execution Module — Execution Protocol v2
 *
 * ExecutionPlan generation and transaction execution
 * GOVERNANCE.md §1.2: ExecutionPlan is deterministic output
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateExecutionPlan = void 0;
var ExecutionPlanGenerator_1 = require("./ExecutionPlanGenerator");
Object.defineProperty(exports, "generateExecutionPlan", { enumerable: true, get: function () { return ExecutionPlanGenerator_1.generateExecutionPlan; } });
// Transaction executor and on-chain interaction will be added here
// Requires Bankr integration for Base chain execution
