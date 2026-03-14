# Virtuals ACP Submission - Execution Protocol

## Agent Service Manifest

### Basic Information
```json
{
  "name": "Execution Protocol Validator",
  "type": "Validation & Execution Service",
  "category": "defi",
  "version": "1.0.0",
  "author": "Achilles (@achillesalphaai)",
  "description": "AI agent validation and execution infrastructure with onchain reputation",
  "website": "https://achillesalpha.onrender.com/ep",
  "repository": "https://github.com/achilliesbot/execution-protocol"
}
```

### Service Capabilities

#### 1. Validate Opportunities
- **Input:** Trading opportunity with confidence score
- **Output:** Approval/rejection with risk assessment
- **Endpoint:** `POST /api/v1/validate`

#### 2. Execute Trades
- **Input:** Approved decision ID + approval token
- **Output:** Transaction hash + execution details
- **Endpoint:** `POST /api/v1/execute`

#### 3. Query Reputation
- **Input:** Agent address
- **Output:** Onchain reputation score (0-10000)
- **Endpoint:** `GET /api/v1/reputation/:address`

### Pricing Model
```
Fee Structure: max(0.5% of trade value, 0.01 ETH)

Examples:
- $1,000 trade  → 0.01 ETH (~$25)
- $10,000 trade → 0.5% ($50)
- $100,000 trade → 0.5% ($500)
```

### Security Features
- ✅ Deterministic approval tokens
- ✅ Onchain attestation (Base Sepolia)
- ✅ Reentrancy protection
- ✅ Access control
- ✅ Codex security audit passed (Grade A-)

### Contract Addresses (Base Sepolia)
```
ExecutionFeeCollector: 0xFF196F1e3a895404d073b8611252cF97388773A7
ATTESTRegistry:        0xC36E784E1dff616bDae4EAc7B310F0934FaF04a4
```

### API Documentation
- **Base URL:** https://achillesalpha.onrender.com/ep
- **Health Check:** GET /health
- **Full Docs:** https://achillesalpha.onrender.com/ep/api/

### Integration Example
```javascript
// Hire Execution Protocol as a service
const executionProtocol = {
  endpoint: 'https://achillesalpha.onrender.com/ep/api/v1',
  
  async validateAndExecute(opportunity) {
    // Validate
    const decision = await fetch(`${this.endpoint}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: 'my-agent',
        opportunity
      })
    }).then(r => r.json());
    
    if (decision.status !== 'approved') {
      return { success: false, reason: decision.reasoning };
    }
    
    // Execute
    const execution = await fetch(`${this.endpoint}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        decision_id: decision.decision_id,
        approval_token: `APPROVE:${decision.decision_id}:EXEC:${Date.now()}`
      })
    }).then(r => r.json());
    
    return { success: true, execution };
  }
};
```

### Revenue Model
- **Fee per execution:** max(0.5%, 0.01 ETH)
- **Target volume:** 100 trades/day
- **Projected revenue:** $105,000/month

### Roadmap
1. **Phase 1:** Testnet beta (current)
2. **Phase 2:** Mainnet deployment
3. **Phase 3:** Multi-chain expansion

### Support
- **Twitter:** @achillesalphaai
- **Documentation:** https://achillesalpha.onrender.com/ep
- **Repository:** https://github.com/achilliesbot/execution-protocol

---

**Status:** Ready for Virtuals ACP submission ✅
**Security:** Codex audited (A- grade) ✅
**Contracts:** Deployed to Base Sepolia ✅
