"""
Live Trading Connectors for Polymarket and BNKR
Wires real APIs with the Pantheon ledger system
"""
import os
import json
import asyncio
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Dict, Any, Optional, Tuple
from dataclasses import dataclass, asdict

# Import from pantheon
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from ledger.hash_chain import HashChainLedger, get_ledger


@dataclass
class LiveExecutionResult:
    """Result of live execution."""
    success: bool
    order_id: str
    status: str  # 'pending', 'filled', 'partial', 'failed', 'rejected'
    filled_amount: float
    filled_price: float
    fees: float
    timestamp: str
    proof_hash: str
    ledger_sequence: int
    exchange_response: Optional[Dict] = None
    error_message: Optional[str] = None
    tx_hash: Optional[str] = None  # For on-chain settlements


class BaseLiveConnector(ABC):
    """Abstract base for live trading connectors."""
    
    def __init__(self, stream_name: str, ledger: Optional[HashChainLedger] = None):
        self.stream_name = stream_name
        self.ledger = ledger or get_ledger()
        self.api_key = None
        self.api_secret = None
        self.is_configured = False
        self._load_credentials()
    
    def _load_credentials(self):
        """Load API credentials from environment."""
        pass  # Override in subclass
    
    def _record_pre_execute(self, proposal: Dict[str, Any]) -> Dict[str, Any]:
        """Record intent to execute."""
        entry = self.ledger.append(
            stream=self.stream_name,
            entry_type='pre_execute',
            payload={
                'proposal': proposal,
                'mode': 'live',
                'timestamp_utc': datetime.now(timezone.utc).isoformat()
            }
        )
        return {
            'sequence': entry.sequence,
            'entry_hash': entry.entry_hash,
            'timestamp': entry.timestamp
        }
    
    def _record_post_execute(self, result: LiveExecutionResult) -> Dict[str, Any]:
        """Record execution result."""
        entry = self.ledger.append(
            stream=self.stream_name,
            entry_type='live_execution',
            payload={
                'order_id': result.order_id,
                'status': result.status,
                'filled_amount': result.filled_amount,
                'filled_price': result.filled_price,
                'fees': result.fees,
                'success': result.success,
                'tx_hash': result.tx_hash,
                'error_message': result.error_message,
                'exchange_response': result.exchange_response
            }
        )
        return {
            'sequence': entry.sequence,
            'entry_hash': entry.entry_hash,
            'timestamp': entry.timestamp
        }
    
    @abstractmethod
    async def validate_and_execute(self, proposal: Dict[str, Any]) -> LiveExecutionResult:
        """Validate proposal and execute if valid."""
        pass
    
    @abstractmethod
    async def get_balance(self) -> Dict[str, float]:
        """Get account balance."""
        pass
    
    @abstractmethod
    async def get_order_status(self, order_id: str) -> Dict[str, Any]:
        """Check status of existing order."""
        pass


class PolymarketLiveConnector(BaseLiveConnector):
    """Live connector for Polymarket using py-clob-client."""
    
    def __init__(self, ledger: Optional[HashChainLedger] = None):
        super().__init__("polymarket", ledger)
        self.clob_client = None
        self.chain_id = 137  # Polygon mainnet
    
    def _load_credentials(self):
        """Load Polymarket API credentials."""
        self.api_key = os.getenv('POLYMARKET_API_KEY')
        self.api_secret = os.getenv('POLYMARKET_API_SECRET')
        self.private_key = os.getenv('POLYMARKET_PRIVATE_KEY')  # For signing
        
        if self.api_key and self.api_secret and self.private_key:
            self.is_configured = True
            self._init_client()
    
    def _init_client(self):
        """Initialize py-clob-client."""
        try:
            # Lazy import - py-clob-client may not be installed
            from py_clob_client.client import ClobClient
            from py_clob_client.clob_types import ApiCreds
            
            host = "https://clob.polymarket.com"
            creds = ApiCreds(
                api_key=self.api_key,
                api_secret=self.api_secret,
                api_passphrase=""  # If needed
            )
            
            self.clob_client = ClobClient(
                host=host,
                key=self.private_key,
                chain_id=self.chain_id,
                creds=creds
            )
            print(f"[POLYMARKET] Client initialized")
        except ImportError:
            print("[POLYMARKET] py-clob-client not installed, running in mock mode")
        except Exception as e:
            print(f"[POLYMARKET] Client init error: {e}")
    
    async def validate_and_execute(self, proposal: Dict[str, Any]) -> LiveExecutionResult:
        """
        Execute on Polymarket.
        
        Required proposal fields:
        - market_id: CLOB market ID
        - side: 'BUY' or 'SELL'
        - size: Number of outcome tokens
        - price: Limit price (0-1)
        - expiration: Order expiration (seconds)
        """
        proposal_id = proposal.get('proposal_id', f"poly_{datetime.now(timezone.utc).timestamp()}")
        
        # Record pre-execution
        pre_record = self._record_pre_execute(proposal)
        
        # Validate
        required = ['market_id', 'side', 'size', 'price']
        missing = [f for f in required if f not in proposal]
        if missing:
            return LiveExecutionResult(
                success=False,
                order_id=f"POLY-{proposal_id}",
                status='rejected',
                filled_amount=0,
                filled_price=0,
                fees=0,
                timestamp=datetime.now(timezone.utc).isoformat(),
                proof_hash=pre_record['entry_hash'],
                ledger_sequence=pre_record['sequence'],
                error_message=f"Missing fields: {missing}"
            )
        
        if not self.is_configured or not self.clob_client:
            # Return mock result for testing
            return await self._mock_execute(proposal, pre_record)
        
        # Live execution
        try:
            from py_clob_client.clob_types import OrderArgs
            
            # Build order
            order_args = OrderArgs(
                price=proposal['price'],
                size=proposal['size'],
                side=proposal['side'],
                token_id=proposal['market_id']
            )
            
            # Create and submit order
            signed_order = self.clob_client.create_order(order_args)
            response = self.clob_client.post_order(signed_order)
            
            result = LiveExecutionResult(
                success=True,
                order_id=response.get('orderID', f"POLY-{proposal_id}"),
                status=response.get('status', 'pending'),
                filled_amount=float(response.get('taken', 0)),
                filled_price=proposal['price'],
                fees=float(response.get('fee', 0)),
                timestamp=datetime.now(timezone.utc).isoformat(),
                proof_hash=pre_record['entry_hash'],
                ledger_sequence=pre_record['sequence'],
                exchange_response=response,
                tx_hash=response.get('transactionHash')
            )
            
            # Record post-execution
            post_record = self._record_post_execute(result)
            result.proof_hash = post_record['entry_hash']
            result.ledger_sequence = post_record['sequence']
            
            return result
            
        except Exception as e:
            error_result = LiveExecutionResult(
                success=False,
                order_id=f"POLY-{proposal_id}",
                status='failed',
                filled_amount=0,
                filled_price=0,
                fees=0,
                timestamp=datetime.now(timezone.utc).isoformat(),
                proof_hash=pre_record['entry_hash'],
                ledger_sequence=pre_record['sequence'],
                error_message=str(e)
            )
            self._record_post_execute(error_result)
            return error_result
    
    async def _mock_execute(self, proposal: Dict, pre_record: Dict) -> LiveExecutionResult:
        """Mock execution for testing without credentials."""
        proposal_id = proposal.get('proposal_id', 'mock')
        
        # Simulate delay
        await asyncio.sleep(0.1)
        
        result = LiveExecutionResult(
            success=True,
            order_id=f"POLY-MOCK-{proposal_id}",
            status='simulated',
            filled_amount=proposal['size'],
            filled_price=proposal['price'],
            fees=proposal['size'] * proposal['price'] * 0.002,
            timestamp=datetime.now(timezone.utc).isoformat(),
            proof_hash=pre_record['entry_hash'],
            ledger_sequence=pre_record['sequence'],
            error_message='MOCK MODE - Set POLYMARKET_API_KEY to enable live trading'
        )
        
        self._record_post_execute(result)
        return result
    
    async def get_balance(self) -> Dict[str, float]:
        """Get USDC balance on Polygon."""
        if not self.is_configured or not self.clob_client:
            return {'usdc': 0.0, 'mode': 'mock'}
        
        try:
            balance = self.clob_client.get_balance()
            return {
                'usdc': float(balance.get('balance', 0)),
                'mode': 'live'
            }
        except Exception as e:
            return {'usdc': 0.0, 'error': str(e)}
    
    async def get_order_status(self, order_id: str) -> Dict[str, Any]:
        """Get order status from Polymarket."""
        if not self.is_configured or not self.clob_client:
            return {'status': 'mock', 'order_id': order_id}
        
        try:
            return self.clob_client.get_order(order_id)
        except Exception as e:
            return {'status': 'error', 'error': str(e)}


class BNKRLiveConnector(BaseLiveConnector):
    """Live connector for BNKR/Base trading."""
    
    def __init__(self, ledger: Optional[HashChainLedger] = None):
        super().__init__("bnkr", ledger)
        self.rpc_url = None
        self.wallet_address = None
        self.contract_address = None
    
    def _load_credentials(self):
        """Load BNKR/Base credentials."""
        self.api_key = os.getenv('BNKR_API_KEY')
        self.rpc_url = os.getenv('BASE_RPC_URL', 'https://mainnet.base.org')
        self.wallet_address = os.getenv('BNKR_WALLET_ADDRESS')
        self.private_key = os.getenv('BNKR_PRIVATE_KEY')
        self.contract_address = os.getenv('BNKR_CONTRACT_ADDRESS')
        
        if self.wallet_address and self.private_key:
            self.is_configured = True
    
    async def validate_and_execute(self, proposal: Dict[str, Any]) -> LiveExecutionResult:
        """
        Execute on BNKR/Base.
        
        Required proposal fields:
        - asset: Token symbol (e.g., 'BNKR')
        - direction: 'buy' or 'sell'
        - amount_usd: USD amount
        - entry_price: Target price
        - stop_loss: Stop loss price
        - take_profit: Take profit price
        """
        proposal_id = proposal.get('proposal_id', f"bnkr_{datetime.now(timezone.utc).timestamp()}")
        
        # Record pre-execution
        pre_record = self._record_pre_execute(proposal)
        
        # Validate
        required = ['asset', 'direction', 'amount_usd', 'entry_price']
        missing = [f for f in required if f not in proposal]
        if missing:
            return LiveExecutionResult(
                success=False,
                order_id=f"BNKR-{proposal_id}",
                status='rejected',
                filled_amount=0,
                filled_price=0,
                fees=0,
                timestamp=datetime.now(timezone.utc).isoformat(),
                proof_hash=pre_record['entry_hash'],
                ledger_sequence=pre_record['sequence'],
                error_message=f"Missing fields: {missing}"
            )
        
        if not self.is_configured:
            return await self._mock_execute(proposal, pre_record)
        
        # Live execution via smart contract or API
        try:
            # This would integrate with BNKR's actual execution layer
            # For now, record the intent and return pending status
            
            result = LiveExecutionResult(
                success=True,
                order_id=f"BNKR-{proposal_id}",
                status='pending',
                filled_amount=0,
                filled_price=0,
                fees=0,
                timestamp=datetime.now(timezone.utc).isoformat(),
                proof_hash=pre_record['entry_hash'],
                ledger_sequence=pre_record['sequence'],
                error_message='Live BNKR integration pending - order recorded in ledger'
            )
            
            post_record = self._record_post_execute(result)
            result.proof_hash = post_record['entry_hash']
            result.ledger_sequence = post_record['sequence']
            
            return result
            
        except Exception as e:
            error_result = LiveExecutionResult(
                success=False,
                order_id=f"BNKR-{proposal_id}",
                status='failed',
                filled_amount=0,
                filled_price=0,
                fees=0,
                timestamp=datetime.now(timezone.utc).isoformat(),
                proof_hash=pre_record['entry_hash'],
                ledger_sequence=pre_record['sequence'],
                error_message=str(e)
            )
            self._record_post_execute(error_result)
            return error_result
    
    async def _mock_execute(self, proposal: Dict, pre_record: Dict) -> LiveExecutionResult:
        """Mock execution for testing."""
        proposal_id = proposal.get('proposal_id', 'mock')
        
        await asyncio.sleep(0.1)
        
        result = LiveExecutionResult(
            success=True,
            order_id=f"BNKR-MOCK-{proposal_id}",
            status='simulated',
            filled_amount=proposal['amount_usd'],
            filled_price=proposal['entry_price'],
            fees=proposal['amount_usd'] * 0.001,
            timestamp=datetime.now(timezone.utc).isoformat(),
            proof_hash=pre_record['entry_hash'],
            ledger_sequence=pre_record['sequence'],
            error_message='MOCK MODE - Set BNKR_WALLET_ADDRESS and BNKR_PRIVATE_KEY for live trading'
        )
        
        self._record_post_execute(result)
        return result
    
    async def get_balance(self) -> Dict[str, float]:
        """Get wallet balance on Base."""
        if not self.is_configured:
            return {'eth': 0.0, 'usdc': 0.0, 'mode': 'mock'}
        
        # Would query Base chain for balances
        return {'eth': 0.0, 'usdc': 0.0, 'mode': 'live', 'address': self.wallet_address}
    
    async def get_order_status(self, order_id: str) -> Dict[str, Any]:
        """Get order status."""
        if not self.is_configured:
            return {'status': 'mock', 'order_id': order_id}
        
        return {'status': 'pending', 'order_id': order_id}


# Factory function
def get_connector(stream_name: str, ledger: Optional[HashChainLedger] = None):
    """Get appropriate connector for stream."""
    if stream_name == 'polymarket':
        return PolymarketLiveConnector(ledger)
    elif stream_name == 'bnkr':
        return BNKRLiveConnector(ledger)
    else:
        raise ValueError(f"Unknown stream: {stream_name}")


async def test_connectors():
    """Test both connectors."""
    print("=" * 60)
    print("Testing Live Trading Connectors")
    print("=" * 60)
    
    import tempfile
    ledger_dir = tempfile.mkdtemp()
    ledger = HashChainLedger(os.path.join(ledger_dir, "ledger"))
    
    # Test Polymarket
    print("\n--- Polymarket Connector ---")
    poly = PolymarketLiveConnector(ledger)
    print(f"Configured: {poly.is_configured}")
    
    proposal = {
        'proposal_id': 'test-live-001',
        'market_id': '0x1234567890abcdef',
        'side': 'BUY',
        'size': 100,
        'price': 0.65
    }
    
    result = await poly.validate_and_execute(proposal)
    print(f"Order: {result.order_id}")
    print(f"Status: {result.status}")
    print(f"Proof: {result.proof_hash[:16]}...")
    
    # Test BNKR
    print("\n--- BNKR Connector ---")
    bnkr = BNKRLiveConnector(ledger)
    print(f"Configured: {bnkr.is_configured}")
    
    proposal2 = {
        'proposal_id': 'test-bnkr-001',
        'asset': 'BNKR',
        'direction': 'buy',
        'amount_usd': 500,
        'entry_price': 0.042,
        'stop_loss': 0.038,
        'take_profit': 0.05
    }
    
    result2 = await bnkr.validate_and_execute(proposal2)
    print(f"Order: {result2.order_id}")
    print(f"Status: {result2.status}")
    print(f"Proof: {result2.proof_hash[:16]}...")
    
    print("\n--- Ledger Summary ---")
    print(f"Total entries: {ledger.get_sequence()}")
    print(f"Integrity: {ledger.verify_integrity()}")
    
    print("\n" + "=" * 60)
    print("Connector test complete!")
    print("=" * 60)
    
    import shutil
    shutil.rmtree(ledger_dir, ignore_errors=True)


if __name__ == "__main__":
    asyncio.run(test_connectors())
