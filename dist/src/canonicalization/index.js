"use strict";
/**
 * Canonicalization Module — Execution Protocol v2
 *
 * Core determinism layer. All proposal hashing goes through here.
 * GOVERNANCE.md §2.1: Canonicalization anchors the stack
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeTranscriptHash = exports.computePolicyHash = exports.computeProposalHash = exports.validateDeterminism = exports.computeHash = exports.canonicalize = void 0;
var Canonicalizer_1 = require("./Canonicalizer");
Object.defineProperty(exports, "canonicalize", { enumerable: true, get: function () { return Canonicalizer_1.canonicalize; } });
Object.defineProperty(exports, "computeHash", { enumerable: true, get: function () { return Canonicalizer_1.computeHash; } });
Object.defineProperty(exports, "validateDeterminism", { enumerable: true, get: function () { return Canonicalizer_1.validateDeterminism; } });
Object.defineProperty(exports, "computeProposalHash", { enumerable: true, get: function () { return Canonicalizer_1.computeProposalHash; } });
Object.defineProperty(exports, "computePolicyHash", { enumerable: true, get: function () { return Canonicalizer_1.computePolicyHash; } });
Object.defineProperty(exports, "computeTranscriptHash", { enumerable: true, get: function () { return Canonicalizer_1.computeTranscriptHash; } });
// Schema validation will be imported from ../schema once built
// Policy binding will be imported from ../policy once built
