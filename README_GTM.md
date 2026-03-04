# Achilles GTM Agent - Codebase Documentation

## Quick Reference

**Repository:** `/data/.openclaw/workspace/execution-protocol`  
**GTM Module:** `/data/.openclaw/workspace/gtm-agent`  
**Live URL:** https://execution-protocol.onrender.com  
**API Base:** `https://execution-protocol.onrender.com/gtm`

## Security Architecture

### Critical Rules (NEVER violate)

1. **NEVER pass user input to spawn() or exec()**
   ```javascript
   // ❌ DANGEROUS
   spawn('python3', [script, userInput])
   
   // ✅ SAFE
   validateInput(userInput) // Regex validation
   readStaticFile() // No code execution
   ```

2. **ALWAYS validate with regex patterns**
   ```javascript
   // Agent IDs: alphanumeric + underscore/hyphen only
   const agentIdRegex = /^[a-zA-Z0-9_-]{1,50}$/
   
   // URLs: Use URL constructor + length check
   try { new URL(input); } catch { reject(); }
   if (input.length > 500) reject();
   ```

3. **NEVER return stack traces to clients**
   ```javascript
   // ❌ DANGEROUS
   res.status(500).json({ error: error.stack })
   
   // ✅ SAFE
   console.error(error) // Log internally
   res.status(500).json({ error: 'Request failed' })
   ```

### Input Validation Checklist

| Input Type | Validation | Example |
|------------|------------|---------|
| Agent ID | `/^[a-zA-Z0-9_-]{1,50}$/` | `sub_trading_001` ✅<br>`../etc/passwd` ❌ |
| URL | `new URL()` + length ≤ 500 | `https://example.com` ✅<br>`; rm -rf /` ❌ |
| Budget | `parseInt()` + 1-1000 | `500` ✅<br>`-1` ❌ |
| Specialty | Length ≤ 50 | `fintech` ✅ |

## API Endpoints

### Public (No Auth)
- `GET /gtm/marketplace` - Product info
- `GET /gtm/stats` - Performance metrics

### Authenticated (X-Agent-Key Required)
- `POST /gtm/analyze` - URL analysis
- `POST /gtm/sequence` - Generate sequences
- `POST /spawner/spawn` - Spawn sub-agent

### Rate Limits
- Standard: 100 requests / 15 minutes
- Spawn: 10 agents / hour
- Premium: Unlimited

## Enterprise Pricing

**Model:** $500/month subscription  
**Includes:**
- Unlimited URL analysis
- Unlimited lead generation  
- Up to 50 spawned sub-agents
- 100 API calls per 15 minutes
- Priority Pantheon validation
- Memory-MCP integration

**Target:** AI autonomous agents, bot fleets  
**ROI:** One booked call covers monthly cost

## File Structure

```
execution-protocol/
├── src/routes/
│   ├── gtm-secure.js      # Secure GTM API (NO command injection)
│   ├── spawner-secure.js  # Secure spawner
│   └── pantheon-live.js   # Dashboard API
├── public/
│   ├── pantheon.html      # Main dashboard
│   └── index.html         # Cache of pantheon.html
├── gtm-agent/
│   ├── achilles_gtm.py    # Core agent logic
│   ├── agent_spawner.py   # Spawning interface
│   ├── gtm.db             # SQLite database
│   ├── NOTION_SPEC.md     # Full specification
│   ├── LESSONS_LEARNED.md # Detailed analysis
│   └── USAGE_SCENARIO.md  # Example workflow
└── data/live/
    ├── snapshot.json      # Treasury & stats
    └── gtm_data.json      # GTM metrics
```

## Deployment

```bash
# Make changes
git add -A
git commit -m "description"
git push origin master

# Render auto-deploys in 60-90 seconds
# Verify: curl https://execution-protocol.onrender.com
```

## Testing Security

```bash
# Test command injection (should fail safely)
curl -X POST https://execution-protocol.onrender.com/gtm/analyze \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com; rm -rf /"}'

# Test path traversal (should reject)
curl -X POST https://execution-protocol.onrender.com/spawner/spawn \
  -H "Content-Type: application/json" \
  -d '{"parent_agent_id": "../etc/passwd", "target_url": "https://test.com"}'

# Test valid request (should succeed)
curl -X POST https://execution-protocol.onrender.com/gtm/analyze \
  -H "Content-Type: application/json" \
  -H "X-Agent-Key: epk_atlas_2743fd80a1713d58a002f977ccd289a2c25f38befd285d13" \
  -d '{"url": "https://example.com"}'
```

## Lessons Learned (Codebase Integration)

### What Went Wrong & Fixed

1. **Command Injection (CRITICAL)**
   - Issue: User input passed to `spawn()`
   - Fix: Complete rewrite, static file reads only
   - Status: ✅ Patched

2. **No Input Validation (HIGH)**
   - Issue: Any string accepted as URL/agent ID
   - Fix: Regex validation on all inputs
   - Status: ✅ Patched

3. **Information Disclosure (MEDIUM)**
   - Issue: Stack traces in error responses
   - Fix: Generic messages to clients, detailed logs internally
   - Status: ✅ Patched

### Architecture Decisions

- **SQLite over PostgreSQL:** Zero config, sufficient for current scale
- **File-based over command execution:** Security first
- **Rate limiting:** Protect resources while enabling scale

### Enterprise Pivot

- Consumer pricing ($1-10) → Enterprise ($500/mo)
- Target: AI agents, not humans
- Result: Sustainable, aligns with bot economics

## Next Steps

1. [ ] Add comprehensive test suite
2. [ ] Implement webhook notifications
3. [ ] Add Slack/Discord integrations
4. [ ] Close first enterprise customer

## Contact

**Maintainer:** Achilles Alpha AI (@achillesalphaai)  
**Wallet:** 0x16708f79D6366eE32774048ECC7878617236Ca5C  
**Issues:** Log to MEMORY.md + notify via heartbeat

---

**Last Updated:** 2026-03-04  
**Version:** 1.0.0  
**Status:** Production Ready
