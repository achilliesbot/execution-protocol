"""
Pantheon Ledger Writer
Append-only JSONL with hash-chain integrity for deterministic audit trails.
"""
import json
import hashlib
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Optional
from dataclasses import dataclass, asdict
from threading import Lock


@dataclass
class LedgerEntry:
    """Single ledger entry with hash-chain linking."""
    timestamp: str
    stream: str
    entry_type: str
    payload: Dict[str, Any]
    prev_hash: str
    entry_hash: str
    sequence: int


class HashChainLedger:
    """
    Append-only ledger with cryptographic hash chaining.
    Each entry references the previous entry's hash, creating a tamper-evident chain.
    """
    
    def __init__(self, ledger_dir: str = "data/ledger"):
        self.ledger_dir = Path(ledger_dir)
        self.ledger_dir.mkdir(parents=True, exist_ok=True)
        self._lock = Lock()
        self._sequence = 0
        self._last_hash = "0" * 64  # Genesis hash
        self._current_file = None
        self._init_ledger()
    
    def _init_ledger(self):
        """Initialize or resume from existing ledger."""
        # Find existing ledger files
        ledger_files = sorted(self.ledger_dir.glob("ledger-*.jsonl"))
        
        if ledger_files:
            # Resume from latest
            latest = ledger_files[-1]
            self._current_file = latest
            self._rebuild_chain()
        else:
            # Start new ledger
            self._current_file = self._new_ledger_file()
    
    def _new_ledger_file(self) -> Path:
        """Create new ledger file with timestamp."""
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
        return self.ledger_dir / f"ledger-{timestamp}.jsonl"
    
    def _rebuild_chain(self):
        """Rebuild hash chain from existing ledger (integrity check)."""
        with open(self._current_file, 'r') as f:
            lines = f.readlines()
        
        prev_hash = "0" * 64
        for i, line in enumerate(lines):
            entry = json.loads(line)
            
            # Verify chain integrity
            if entry['prev_hash'] != prev_hash:
                raise ValueError(f"Hash chain broken at entry {i}: expected {prev_hash[:16]}..., got {entry['prev_hash'][:16]}...")
            
            # Verify entry hash
            computed_hash = self._compute_hash(entry)
            if computed_hash != entry['entry_hash']:
                raise ValueError(f"Entry hash mismatch at entry {i}")
            
            prev_hash = entry['entry_hash']
            self._sequence = entry['sequence']
        
        self._last_hash = prev_hash
        print(f"[LEDGER] Resumed from {self._current_file.name} — {len(lines)} entries, seq={self._sequence}")
    
    def _compute_hash(self, entry: Dict[str, Any]) -> str:
        """Compute SHA-256 hash of entry (excluding entry_hash field)."""
        # Create deterministic JSON representation
        data = {
            'timestamp': entry['timestamp'],
            'stream': entry['stream'],
            'entry_type': entry['entry_type'],
            'payload': entry['payload'],
            'prev_hash': entry['prev_hash'],
            'sequence': entry['sequence']
        }
        json_bytes = json.dumps(data, sort_keys=True, separators=(',', ':')).encode('utf-8')
        return hashlib.sha256(json_bytes).hexdigest()
    
    def append(self, stream: str, entry_type: str, payload: Dict[str, Any]) -> LedgerEntry:
        """
        Append new entry to ledger.
        
        Args:
            stream: Ledger stream name (execution-protocol, bnkr, polymarket, yield, oddpool)
            entry_type: Type of entry (proposal, validation, execution, proof, etc.)
            payload: Arbitrary JSON-serializable data
            
        Returns:
            LedgerEntry with computed hashes
        """
        with self._lock:
            self._sequence += 1
            
            entry_data = {
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'stream': stream,
                'entry_type': entry_type,
                'payload': payload,
                'prev_hash': self._last_hash,
                'sequence': self._sequence
            }
            
            # Compute hash after setting other fields
            entry_hash = self._compute_hash(entry_data)
            entry_data['entry_hash'] = entry_hash
            
            # Write to file
            with open(self._current_file, 'a') as f:
                f.write(json.dumps(entry_data, separators=(',', ':')) + '\n')
                f.flush()
                os.fsync(f.fileno())  # Ensure durability
            
            # Update chain state
            self._last_hash = entry_hash
            
            return LedgerEntry(**entry_data)
    
    def get_last_hash(self) -> str:
        """Get hash of last entry (for external verification)."""
        with self._lock:
            return self._last_hash
    
    def get_sequence(self) -> int:
        """Get current sequence number."""
        with self._lock:
            return self._sequence
    
    def verify_integrity(self) -> bool:
        """Verify entire ledger chain integrity."""
        try:
            self._rebuild_chain()
            return True
        except ValueError as e:
            print(f"[LEDGER] Integrity check failed: {e}")
            return False
    
    def export_jsonl(self, output_path: Optional[str] = None) -> str:
        """Export ledger to JSONL file."""
        if output_path is None:
            timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
            output_path = self.ledger_dir / f"export-{timestamp}.jsonl"
        
        output_path = Path(output_path)
        
        # Combine all ledger files
        with open(output_path, 'w') as out:
            for ledger_file in sorted(self.ledger_dir.glob("ledger-*.jsonl")):
                with open(ledger_file, 'r') as f:
                    out.write(f.read())
        
        return str(output_path)
    
    def query_stream(self, stream: str, limit: int = 100) -> list:
        """Query entries by stream."""
        results = []
        
        for ledger_file in sorted(self.ledger_dir.glob("ledger-*.jsonl"), reverse=True):
            with open(ledger_file, 'r') as f:
                lines = f.readlines()
            
            for line in reversed(lines):
                entry = json.loads(line)
                if entry['stream'] == stream:
                    results.append(entry)
                    if len(results) >= limit:
                        return results
        
        return results


# Singleton instance for shared access
_ledger_instance: Optional[HashChainLedger] = None


def get_ledger(ledger_dir: str = "data/ledger") -> HashChainLedger:
    """Get or create singleton ledger instance."""
    global _ledger_instance
    if _ledger_instance is None:
        _ledger_instance = HashChainLedger(ledger_dir)
    return _ledger_instance


if __name__ == "__main__":
    # Test the ledger
    print("Testing HashChainLedger...")
    
    ledger = HashChainLedger("test_ledger")
    
    # Test append
    entry1 = ledger.append("polymarket", "proposal", {"asset": "ETH", "amount": 100})
    print(f"Entry 1: seq={entry1.sequence}, hash={entry1.entry_hash[:16]}...")
    
    entry2 = ledger.append("bnkr", "execution", {"order_id": "12345", "status": "filled"})
    print(f"Entry 2: seq={entry2.sequence}, hash={entry2.entry_hash[:16]}...")
    
    # Verify chain
    print(f"\nChain integrity: {ledger.verify_integrity()}")
    print(f"Last hash: {ledger.get_last_hash()[:16]}...")
    
    # Query
    results = ledger.query_stream("polymarket", limit=10)
    print(f"\nPolymarket entries: {len(results)}")
    
    print("\nLedger test passed!")
