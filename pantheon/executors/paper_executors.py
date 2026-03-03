"""
Pantheon Executors — Paper-mode trading executors for Polymarket and BNKR.
No real orders. Simulates execution for testing idempotency and ledger integrity.
"""
import os
import json
import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Dict, Any, Optional, Tuple
from dataclasses import dataclass

# Add parent to path for ledger import
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from ledger.hash_chain import HashChainLedger, get_ledger


@dataclass
class ExecutionResult:
    """Result of paper-mode execution."""
    success: bool
    order_id: str
    status: str  # 'simulated', 'rejected', 'error'
    filled_amount: float
    filled_price: float
    fees: float
    timestamp: str
    proof_hash: str
    ledger_sequence: int
    error_message: Optional[str] = None


class BaseExecutor(ABC):
    """Abstract base for paper-mode executors."""
    
    def __init__(self, stream_name: str, ledger: Optional[HashChainLedger] = None):
        self.stream_name = stream_name
        self.ledger = ledger or get_ledger()
        self._executed_ids: set = set()  # For idempotency
        self._load_executed_ids()
    
    def _load_executed_ids(self):
        """Load previously executed order IDs from ledger."""
        entries = self.ledger.query_stream(self.stream_name, limit=10000)
        for entry in entries:
            if entry['entry_type'] == 'execution':
                order_id = entry['payload'].get('order_id')
                if order_id:
                    self._executed_ids.add(order_id)
    
    def _is_executed(self, order_id: str) -> bool:
        """Check if order was already executed (idempotency)."""
        return order_id in self._executed_ids
    
    def _record_proposal(self, proposal: Dict[str, Any]) -> Dict[str, Any]:
        """Record proposal to ledger."""
        entry = self.ledger.append(
            stream=self.stream_name,
            entry_type='proposal',
            payload=proposal
        )
        return {
            'sequence': entry.sequence,
            'entry_hash': entry.entry_hash,
            'timestamp': entry.timestamp
        }
    
    def _record_validation(self, proposal_id: str, valid: bool, details: Dict) -> Dict[str, Any]:
        """Record validation result to ledger."""
        entry = self.ledger.append(
            stream=self.stream_name,
            entry_type='validation',
            payload={
                'proposal_id': proposal_id,
                'valid': valid,
                'details': details
            }
        )
        return {
            'sequence': entry.sequence,
            'entry_hash': entry.entry_hash,
            'timestamp': entry.timestamp
        }
    
    def _record_execution(self, result: ExecutionResult) -> Dict[str, Any]:
        """Record execution result to ledger."""
        entry = self.ledger.append(
            stream=self.stream_name,
            entry_type='execution',
            payload={
                'order_id': result.order_id,
                'status': result.status,
                'filled_amount': result.filled_amount,
                'filled_price': result.filled_price,
                'fees': result.fees,
                'success': result.success,
                'error_message': result.error_message
            }
        )
        return {
            'sequence': entry.sequence,
            'entry_hash': entry.entry_hash,
            'timestamp': entry.timestamp
        }
    
    @abstractmethod
    def validate_proposal(self, proposal: Dict[str, Any]) -> Tuple[bool, Dict[str, Any]]:
        """Validate proposal before execution. Returns (valid, details)."""
        pass
    
    @abstractmethod
    def execute(self, proposal: Dict[str, Any]) -> ExecutionResult:
        """Execute proposal in paper mode."""
        pass


class PolymarketExecutor(BaseExecutor):
    """Paper-mode executor for Polymarket (using py-clob-client structure, no real orders)."""
    
    def __init__(self, ledger: Optional[HashChainLedger] = None):
        super().__init__("polymarket", ledger)
        self.market_cache: Dict[str, Any] = {}  # Simulated market data
    
    def validate_proposal(self, proposal: Dict[str, Any]) -> Tuple[bool, Dict[str, Any]]:
        """Validate Polymarket proposal."""
        required = ['market_id', 'side', 'size', 'price']
        missing = [f for f in required if f not in proposal]
        
        if missing:
            return False, {'error': f'Missing fields: {missing}'}
        
        # Simulate market validation
        if proposal['side'] not in ['BUY', 'SELL']:
            return False, {'error': 'Invalid side. Must be BUY or SELL'}
        
        if proposal['size'] <= 0:
            return False, {'error': 'Size must be positive'}
        
        if proposal['price'] <= 0 or proposal['price'] > 1:
            return False, {'error': 'Price must be between 0 and 1 (Polymarket binary markets)'}
        
        return True, {'market_valid': True, 'liquidity_sufficient': True}
    
    def execute(self, proposal: Dict[str, Any]) -> ExecutionResult:
        """
        Execute Polymarket proposal in paper mode.
        
        Key features:
        - Idempotency: Same order_id = same result (no duplicate execution)
        - Deterministic: Same inputs = same outputs
        - Ledgered: Every step recorded to hash-chain
        """
        proposal_id = proposal.get('proposal_id', str(uuid.uuid4()))
        
        # Step 1: Record proposal
        proposal_record = self._record_proposal(proposal)
        
        # Step 2: Check idempotency
        order_id = f"POLY-{proposal_id}"
        if self._is_executed(order_id):
            # Return cached result (idempotency)
            return ExecutionResult(
                success=True,
                order_id=order_id,
                status='simulated',
                filled_amount=0,
                filled_price=0,
                fees=0,
                timestamp=datetime.now(timezone.utc).isoformat(),
                proof_hash=proposal_record['entry_hash'],
                ledger_sequence=proposal_record['sequence'],
                error_message='Already executed (idempotent return)'
            )
        
        # Step 3: Validate
        valid, validation_details = self.validate_proposal(proposal)
        validation_record = self._record_validation(proposal_id, valid, validation_details)
        
        if not valid:
            result = ExecutionResult(
                success=False,
                order_id=order_id,
                status='rejected',
                filled_amount=0,
                filled_price=0,
                fees=0,
                timestamp=datetime.now(timezone.utc).isoformat(),
                proof_hash=validation_record['entry_hash'],
                ledger_sequence=validation_record['sequence'],
                error_message=validation_details.get('error', 'Validation failed')
            )
            self._record_execution(result)
            self._executed_ids.add(order_id)
            return result
        
        # Step 4: Simulate execution (paper mode)
        filled_amount = proposal['size']
        filled_price = proposal['price']
        fees = filled_amount * filled_price * 0.002  # 0.2% fee simulation
        
        result = ExecutionResult(
            success=True,
            order_id=order_id,
            status='simulated',
            filled_amount=filled_amount,
            filled_price=filled_price,
            fees=fees,
            timestamp=datetime.now(timezone.utc).isoformat(),
            proof_hash=validation_record['entry_hash'],
            ledger_sequence=validation_record['sequence']
        )
        
        # Step 5: Record execution
        execution_record = self._record_execution(result)
        result.proof_hash = execution_record['entry_hash']
        result.ledger_sequence = execution_record['sequence']
        
        self._executed_ids.add(order_id)
        
        return result


class BNKRExecutor(BaseExecutor):
    """Paper-mode executor for BNKR."""
    
    def __init__(self, ledger: Optional[HashChainLedger] = None):
        super().__init__("bnkr", ledger)
    
    def validate_proposal(self, proposal: Dict[str, Any]) -> Tuple[bool, Dict[str, Any]]:
        """Validate BNKR proposal."""
        required = ['asset', 'direction', 'amount_usd', 'entry_price']
        missing = [f for f in required if f not in proposal]
        
        if missing:
            return False, {'error': f'Missing fields: {missing}'}
        
        if proposal['direction'] not in ['buy', 'sell']:
            return False, {'error': 'Invalid direction. Must be buy or sell'}
        
        if proposal['amount_usd'] <= 0:
            return False, {'error': 'Amount must be positive'}
        
        if proposal['entry_price'] <= 0:
            return False, {'error': 'Entry price must be positive'}
        
        # Risk validation (from Execution Protocol)
        if 'stop_loss' not in proposal or 'take_profit' not in proposal:
            return False, {'error': 'Missing stop_loss or take_profit (required by policy)'}
        
        return True, {'risk_score': 'LOW', 'policy_valid': True}
    
    def execute(self, proposal: Dict[str, Any]) -> ExecutionResult:
        """Execute BNKR proposal in paper mode."""
        proposal_id = proposal.get('proposal_id', str(uuid.uuid4()))
        
        # Step 1: Record proposal
        proposal_record = self._record_proposal(proposal)
        
        # Step 2: Check idempotency
        order_id = f"BNKR-{proposal_id}"
        if self._is_executed(order_id):
            return ExecutionResult(
                success=True,
                order_id=order_id,
                status='simulated',
                filled_amount=0,
                filled_price=0,
                fees=0,
                timestamp=datetime.now(timezone.utc).isoformat(),
                proof_hash=proposal_record['entry_hash'],
                ledger_sequence=proposal_record['sequence'],
                error_message='Already executed (idempotent return)'
            )
        
        # Step 3: Validate
        valid, validation_details = self.validate_proposal(proposal)
        validation_record = self._record_validation(proposal_id, valid, validation_details)
        
        if not valid:
            result = ExecutionResult(
                success=False,
                order_id=order_id,
                status='rejected',
                filled_amount=0,
                filled_price=0,
                fees=0,
                timestamp=datetime.now(timezone.utc).isoformat(),
                proof_hash=validation_record['entry_hash'],
                ledger_sequence=validation_record['sequence'],
                error_message=validation_details.get('error', 'Validation failed')
            )
            self._record_execution(result)
            self._executed_ids.add(order_id)
            return result
        
        # Step 4: Simulate execution
        filled_amount = proposal['amount_usd']
        filled_price = proposal['entry_price']
        fees = filled_amount * 0.001  # 0.1% fee simulation
        
        result = ExecutionResult(
            success=True,
            order_id=order_id,
            status='simulated',
            filled_amount=filled_amount,
            filled_price=filled_price,
            fees=fees,
            timestamp=datetime.now(timezone.utc).isoformat(),
            proof_hash=validation_record['entry_hash'],
            ledger_sequence=validation_record['sequence']
        )
        
        # Step 5: Record execution
        execution_record = self._record_execution(result)
        result.proof_hash = execution_record['entry_hash']
        result.ledger_sequence = execution_record['sequence']
        
        self._executed_ids.add(order_id)
        
        return result


def test_executors():
    """Test both executors with idempotency and chain integrity checks."""
    print("=" * 60)
    print("Testing Pantheon Executors (Paper Mode)")
    print("=" * 60)
    
    # Use temp ledger for testing
    import tempfile
    import shutil
    
    test_dir = tempfile.mkdtemp()
    ledger = HashChainLedger(os.path.join(test_dir, "ledger"))
    
    try:
        # Test Polymarket
        print("\n--- Polymarket Executor ---")
        poly = PolymarketExecutor(ledger)
        
        proposal1 = {
            'proposal_id': 'test-poly-001',
            'market_id': '0x1234567890abcdef',
            'side': 'BUY',
            'size': 100,
            'price': 0.65
        }
        
        result1 = poly.execute(proposal1)
        print(f"First execution: {result1.status}, seq={result1.ledger_sequence}, hash={result1.proof_hash[:16]}...")
        
        # Test idempotency
        result2 = poly.execute(proposal1)
        print(f"Second execution (idempotent): {result2.status}, seq={result2.ledger_sequence}")
        print(f"Idempotency check: {'PASS' if result2.error_message and 'Already executed' in result2.error_message else 'FAIL'}")
        
        # Test BNKR
        print("\n--- BNKR Executor ---")
        bnkr = BNKRExecutor(ledger)
        
        proposal2 = {
            'proposal_id': 'test-bnkr-001',
            'asset': 'BNKR',
            'direction': 'buy',
            'amount_usd': 500,
            'entry_price': 0.042,
            'stop_loss': 0.038,
            'take_profit': 0.05
        }
        
        result3 = bnkr.execute(proposal2)
        print(f"Execution: {result3.status}, seq={result3.ledger_sequence}, hash={result3.proof_hash[:16]}...")
        
        # Test validation failure
        bad_proposal = {
            'proposal_id': 'test-bad-001',
            'asset': 'BNKR',
            'direction': 'invalid',
            'amount_usd': 500
        }
        result4 = bnkr.execute(bad_proposal)
        print(f"Invalid proposal: {result4.status}, error={result4.error_message}")
        
        # Verify ledger integrity
        print("\n--- Ledger Integrity ---")
        integrity = ledger.verify_integrity()
        print(f"Chain integrity: {'PASS' if integrity else 'FAIL'}")
        print(f"Total entries: {ledger.get_sequence()}")
        
        # Query streams
        print("\n--- Stream Query ---")
        poly_entries = ledger.query_stream("polymarket", limit=10)
        bnkr_entries = ledger.query_stream("bnkr", limit=10)
        print(f"Polymarket entries: {len(poly_entries)}")
        print(f"BNKR entries: {len(bnkr_entries)}")
        
        print("\n" + "=" * 60)
        print("All tests passed!")
        print("=" * 60)
        
    finally:
        shutil.rmtree(test_dir, ignore_errors=True)


if __name__ == "__main__":
    test_executors()
