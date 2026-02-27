"use strict";
/**
 * Policy Engine Module — Execution Protocol v2
 *
 * GOVERNANCE.md §2: Policy binding anchors the stack
 * All executions must validate against active policy set
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateAgainstPolicySet = exports.computePolicySetHash = exports.createPhase1PolicySet = void 0;
var PolicyEngine_1 = require("./PolicyEngine");
Object.defineProperty(exports, "createPhase1PolicySet", { enumerable: true, get: function () { return PolicyEngine_1.createPhase1PolicySet; } });
Object.defineProperty(exports, "computePolicySetHash", { enumerable: true, get: function () { return PolicyEngine_1.computePolicySetHash; } });
Object.defineProperty(exports, "validateAgainstPolicySet", { enumerable: true, get: function () { return PolicyEngine_1.validateAgainstPolicySet; } });
// Policy versioning and migration utilities will be added here
// as the protocol evolves through phases
