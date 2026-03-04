# GTM API Security Audit Report

**Date:** 2026-03-04  
**Auditor:** Achilles Alpha  
**Scope:** /gtm/* and /spawner/* endpoints

## VULNERABILITIES IDENTIFIED

### 🔴 CRITICAL: Command Injection (2 findings)

**File:** `src/routes/gtm.js`, `src/routes/spawner.js`
**Issue:** Direct user input passed to `spawn()`
**Code:**
```javascript
const { stdout } = await promisify(spawn)('python3', [
  scriptPath,
  '--spawn',
  parent_agent_id,  // USER INPUT - DANGEROUS
  target_url,       // USER INPUT - DANGEROUS
  specialty || 'general',
  budget || '50'
]);
```
**Risk:** Attacker can inject shell commands  
**Fix:** Validate/sanitize all inputs before passing to spawn

---

### 🟠 HIGH: No Input Validation

**Endpoints Affected:**
- POST /gtm/analyze
- POST /spawner/spawn

**Issue:** No validation on:
- `url` parameter (could be any string)
- `parent_agent_id` (could be malicious)
- `budget` (no type checking)

**Risk:** 
- Path traversal attacks
- Invalid data types
- Resource exhaustion

**Fix:** Add Joi/Zod validation schema

---

### 🟡 MEDIUM: Path Traversal

**File:** `src/routes/gtm.js:15`
**Code:**
```javascript
const scriptPath = path.join(process.cwd(), '..', 'gtm-agent', 'achilles_gtm.py');
```
**Issue:** If process.cwd() is manipulated, could access unintended files

**Fix:** Use absolute paths from config

---

### 🟡 MEDIUM: Information Disclosure

**File:** `src/routes/gtm.js:33`
**Code:**
```javascript
res.status(500).json({
  error: 'Analysis failed',
  message: error.message  // Leaks stack traces
});
```
**Issue:** Error messages leak internal details

**Fix:** Log detailed errors, return generic messages to client

---

### 🟢 LOW: Missing Rate Limiting

**Issue:** No rate limiting on endpoints
**Risk:** DDoS, brute force
**Fix:** Add express-rate-limit

---

## RECOMMENDATIONS

1. **NEVER pass user input directly to spawn()**
2. **Add input validation middleware**
3. **Sanitize all user inputs**
4. **Use parameterized queries everywhere**
5. **Add rate limiting**
6. **Remove stack traces from error responses**

## SECURE CODE PATTERN

```javascript
// Input validation
const Joi = require('joi');

const spawnSchema = Joi.object({
  parent_agent_id: Joi.string().alphanum().max(50).required(),
  target_url: Joi.string().uri().max(500).required(),
  specialty: Joi.string().max(50).optional(),
  budget: Joi.number().integer().min(1).max(1000).optional()
});

// Sanitized execution
const { error, value } = spawnSchema.validate(req.body);
if (error) return res.status(400).json({ error: 'Invalid input' });

// Safe spawn with validated data
const result = await runPythonScript(value); // Use validated object
```

## STATUS

**Overall Grade:** D+ (Multiple critical vulnerabilities)
**Action Required:** Fix before production use
