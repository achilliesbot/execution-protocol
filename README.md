# Execution Protocol v1.0 — Multi-Tenant Infrastructure

## Overview
Deterministic middleware for AI agent swarms. Policy enforcement, session isolation, and verification-as-a-service.

## Architecture
- Multi-tenant: Each agent has isolated sessions and data
- Authentication: X-Agent-Key header required
- Core endpoint: POST /ep/validate — policy enforcement for any agent

## Quick Start
```bash
npm install
npm start
```

## Live Service
- https://execution-protocol.onrender.com

## Documentation
- Phase 8 docs: https://github.com/achilliesbot/execution-protocol/tree/master/docs/phase8

## Schemas
- OpportunityProposal v1: https://execution-protocol.onrender.com/schemas/opportunity-proposal.v1.json
- VerificationResult v1: https://execution-protocol.onrender.com/schemas/verification-result.v1.json

## API Endpoints
- GET /ep/health — Health check (no auth)
- GET /ep/status — Service status (no auth)
- POST /ep/validate — Validate proposal (requires X-Agent-Key)

## Environment Variables
- EP_MODE — DRY_RUN or LIVE
- EP_KEY_ACHILLES, EP_KEY_ARGUS, EP_KEY_ATLAS — Agent API keys
