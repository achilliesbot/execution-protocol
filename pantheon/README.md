# Pantheon — Execution Protocol Dashboard

**Pantheon** is the public-facing dashboard and ledger system for Execution Protocol. It provides:

- **Clean Public UI** — Revenue, streams, treasury at a glance
- **Paper-Mode Executors** — Test trading without real capital
- **Hash-Chain Ledger** — Tamper-evident audit trail
- **Admin Tools** — Ledger export, integrity checks, proof lookup

---

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Public UI     │     │   API Routes    │     │   Ledger        │
│  (pantheon.html)│────▶│  (pantheon.js)  │────▶│ (hash_chain.py) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                                               │
        ▼                                               ▼
┌─────────────────┐                         ┌─────────────────┐
│  Overview       │                         │  Executors      │
│  Streams        │                         │  (paper mode)   │
│  Income         │                         └─────────────────┘
│  Integrate      │                                   │
│  Vault          │                                   ▼
└─────────────────┘                         ┌─────────────────┐
                                            │ Polymarket      │
                                            │ BNKR            │
                                            └─────────────────┘
```

---

## Quick Start

### 1. Install Python dependencies (for executors)

```bash
cd pantheon
pip install -r requirements.txt  # if needed
```

### 2. Start the server

```bash
npm start
```

### 3. Open Pantheon UI

Visit `http://localhost:3000/` — redirects to the dashboard.

---

## Ledger System

The ledger is **append-only** with **cryptographic hash chaining**:

```python
from pantheon.ledger import get_ledger

ledger = get_ledger("data/ledger")

# Append entry
entry = ledger.append(
    stream="polymarket",
    entry_type="execution",
    payload={"order_id": "123", "filled": 100}
)

# Verify integrity
assert ledger.verify_integrity() == True

# Query by stream
entries = ledger.query_stream("polymarket", limit=100)
```

Each entry contains:
- `timestamp` — ISO 8601 UTC
- `stream` — Stream name (polymarket, bnkr, etc.)
- `entry_type` — proposal, validation, execution, proof
- `payload` — Arbitrary JSON data
- `prev_hash` — Hash of previous entry
- `entry_hash` — SHA-256 of this entry
- `sequence` — Monotonic counter

---

## Paper-Mode Executors

Test trading logic without real orders:

```python
from pantheon.executors import PolymarketExecutor, BNKRExecutor

poly = PolymarketExecutor()
bnkr = BNKRExecutor()

# Execute proposal
result = poly.execute({
    "proposal_id": "prop_001",
    "market_id": "0x123...",
    "side": "BUY",
    "size": 100,
    "price": 0.65
})

print(result.status)      # "simulated"
print(result.proof_hash)  # Ledger hash for audit
print(result.ledger_sequence)
```

**Idempotency guarantee:** Same `proposal_id` = same result, no duplicate ledger entries.

---

## API Endpoints

### Public (No Auth)

| Endpoint | Description |
|----------|-------------|
| `GET /pantheon/overview` | Revenue 7d/30d/all-time, treasury, streams |
| `GET /pantheon/streams` | Detailed stream info |
| `GET /pantheon/income` | Daily income history (30d) |
| `GET /pantheon/integrate` | API documentation |
| `GET /pantheon/vault` | Phase status (8, 9, 10) |

### Admin (Requires `PANTHEON_ADMIN_KEY`)

| Endpoint | Description |
|----------|-------------|
| `GET /admin/ledger?stream=&limit=` | Query ledger entries |
| `GET /admin/proofs/:hash` | Lookup proof by hash |
| `GET /admin/integrity` | Verify chain integrity |
| `GET /admin/export` | Download full ledger (JSONL) |

---

## Environment Variables

```bash
# Admin access
PANTHEON_ADMIN_KEY=your_secret_key_here

# Ledger location
LEDGER_DIR=./data/ledger

# Server
PORT=3000
EP_MODE=DRY_RUN
```

---

## File Structure

```
pantheon/
├── ledger/
│   ├── __init__.py
│   └── hash_chain.py      # HashChainLedger implementation
├── executors/
│   ├── __init__.py
│   └── paper_executors.py # Polymarket + BNKR executors
└── ui/
    └── (frontend assets)  # Served from public/

public/
└── pantheon.html          # Main dashboard

src/routes/
└── pantheon.js            # API route handlers
```

---

## Design Principles

1. **Top = Money + Proof** — Revenue and verification first
2. **Middle = Streams** — Live trading activity
3. **Bottom = Activity + Vault** — Logs and future features
4. **Clean Public / Powerful Admin** — Public sees metrics, admin sees everything
5. **Deterministic + Auditable** — Every action logged, every hash verifiable

---

## Phase Status

| Phase | Name | Status |
|-------|------|--------|
| 8 | Entropy Detector | 🟡 Beta |
| 9 | Agent Entropy Detector | 🟢 Launch |
| 10 | Achilles Memory Map | 🔒 Coming Soon |

---

**⚔️ Seven streams. One protocol. Zero dependence.**
