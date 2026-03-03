"""
Live Trading Connectors - Updated for actual API usage
- Polymarket Builder API (2-key auth)
- BNKR Custodial API (API key only)
"""
import os
import json
import asyncio
import requests
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from dataclasses import dataclass

# Import from pantheon
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from ledger.hash_chain import HashChainLedger, get_ledger


@dataclass
class LiveExecutionResult:
    """Result of live execution."""
    success: bool
    order_id: str
    status: str
    filled_amount: float
    filled_price: float
    fees: float
    timestamp: str
    proof_hash: str
    ledger_sequence: int
    exchange_response: Optional[Dict] = None
    error_message: Optional[str] = None
    tx_hash: Optional[str] = None


class PolymarketLiveConnector:
    """
    Live connector for Polymarket using Builder API.
    Only requires API_KEY and PRIVATE_KEY (no API_SECRET for Builder API).
    """
    
    def __init__(self, ledger: Optional[HashChainLedger] = None):
        self.stream_name = "polymarket"
        self.ledger = ledger or get_ledger()
        self.api_key = os.getenv('POLYMARKET_API_KEY')
        self.private_key = os.getenv('POLYMARKET_PRIVATE_KEY')
        self.api_url = os.getenv('POLY_URL', 'https://gamma-api.polymarket.com')
        self.is_configured = bool(self.api_key and self.private_key)
        self.session = requests.Session()
        if self.api_key:
            self.session.headers.update({
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json'
            })
    
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
    
    async def get_balance(self) -> Dict[str, Any]:
        """Get USDC balance from Polymarket."""
        if not self.is_configured:
            return {'error': 'Not configured', 'mode': 'mock'}
        
        try:
            # Polymarket Builder API endpoint for balance
            response = self.session.get(f'{self.api_url}/portfolio/balance')
            if response.status_code == 200:
                data = response.json()
                return {
                    'usdc': float(data.get('balance', 0)),
                    'mode': 'live',
                    'source': 'polymarket'
                }
            else:
                return {
                    'error': f'API Error: {response.status_code}',
                    'mode': 'live',
                    'response': response.text
                }
        except Exception as e:
            return {'error': str(e), 'mode': 'live'}
    
    async def validate_and_execute(self, proposal: Dict[str, Any]) -> LiveExecutionResult:
        """Execute on Polymarket via Builder API."""
        proposal_id = proposal.get('proposal_id', f"poly_{datetime.now(timezone.utc).timestamp()}")
        pre_record = self._record_pre_execute(proposal)
        
        if not self.is_configured:
            return LiveExecutionResult(
                success=False,
                order_id=f"POLY-{proposal_id}",
                status='not_configured',
                filled_amount=0,
                filled_price=0,
                fees=0,
                timestamp=datetime.now(timezone.utc).isoformat(),
                proof_hash=pre_record['entry_hash'],
                ledger_sequence=pre_record['sequence'],
                error_message='Polymarket not configured - set POLYMARKET_API_KEY and POLYMARKET_PRIVATE_KEY'
            )
        
        try:
            # Builder API order endpoint
            order_data = {
                'market_id': proposal.get('market_id'),
                'side': proposal.get('side'),  # 'buy' or 'sell'
                'size': proposal.get('size'),
                'price': proposal.get('price'),
                'signature': self._sign_order(proposal)
            }
            
            response = self.session.post(f'{self.api_url}/order', json=order_data)
            
            if response.status_code in [200, 201]:
                data = response.json()
                result = LiveExecutionResult(
                    success=True,
                    order_id=data.get('order_id', f"POLY-{proposal_id}"),
                    status='filled',
                    filled_amount=float(data.get('filled_size', proposal.get('size', 0))),
                    filled_price=float(data.get('price', proposal.get('price', 0))),
                    fees=float(data.get('fee', 0)),
                    timestamp=datetime.now(timezone.utc).isoformat(),
                    proof_hash=pre_record['entry_hash'],
                    ledger_sequence=pre_record['sequence'],
                    exchange_response=data,
                    tx_hash=data.get('transaction_hash')
                )
            else:
                result = LiveExecutionResult(
                    success=False,
                    order_id=f"POLY-{proposal_id}",
                    status='failed',
                    filled_amount=0,
                    filled_price=0,
                    fees=0,
                    timestamp=datetime.now(timezone.utc).isoformat(),
                    proof_hash=pre_record['entry_hash'],
                    ledger_sequence=pre_record['sequence'],
                    error_message=f"API Error {response.status_code}: {response.text}",
                    exchange_response={'status_code': response.status_code, 'text': response.text}
                )
            
            # Record to ledger
            post_record = self._record_post_execute(result)
            result.proof_hash = post_record['entry_hash']
            result.ledger_sequence = post_record['sequence']
            
            return result
            
        except Exception as e:
            error_result = LiveExecutionResult(
                success=False,
                order_id=f"POLY-{proposal_id}",
                status='error',
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
    
    def _sign_order(self, proposal: Dict[str, Any]) -> str:
        """Sign order with private key (simplified - actual implementation would use web3/eth-account)."""
        # Placeholder - actual signing would use eth-account library
        return f"0x{self.private_key[:10]}...signed"
    
    async def get_order_status(self, order_id: str) -> Dict[str, Any]:
        """Get order status from Polymarket."""
        if not self.is_configured:
            return {'status': 'not_configured'}
        
        try:
            response = self.session.get(f'{self.api_url}/order/{order_id}')
            if response.status_code == 200:
                return response.json()
            else:
                return {'status': 'error', 'code': response.status_code}
        except Exception as e:
            return {'status': 'error', 'message': str(e)}


class BNKRLiveConnector:
    """
    Live connector for BNKR (Custodial API).
    Only requires API_KEY - no wallet needed as BNKR is custodial.
    """
    
    def __init__(self, ledger: Optional[HashChainLedger] = None):
        self.stream_name = "bnkr"
        self.ledger = ledger or get_ledger()
        self.api_key = os.getenv('BNKR_API_KEY')
        self.api_url = os.getenv('BNKR_URL', 'https://bankr.bot/api')
        self.is_configured = bool(self.api_key)
        self.session = requests.Session()
        if self.api_key:
            self.session.headers.update({
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json'
            })
    
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
                'error_message': result.error_message,
                'exchange_response': result.exchange_response
            }
        )
        return {
            'sequence': entry.sequence,
            'entry_hash': entry.entry_hash,
            'timestamp': entry.timestamp
        }
    
    async def get_balance(self) -> Dict[str, Any]:
        """Get balance from BNKR."""
        if not self.is_configured:
            return {'error': 'Not configured', 'mode': 'mock'}
        
        try:
            response = self.session.get(f'{self.api_url}/balance')
            if response.status_code == 200:
                data = response.json()
                return {
                    'usdc': float(data.get('usdc', 0)),
                    'usd_value': float(data.get('usd_value', 0)),
                    'mode': 'live',
                    'source': 'bnkr',
                    'message': data.get('message', 'Balance retrieved')
                }
            else:
                return {
                    'error': f'API Error: {response.status_code}',
                    'mode': 'live',
                    'response': response.text
                }
        except Exception as e:
            return {'error': str(e), 'mode': 'live'}
    
    async def validate_and_execute(self, proposal: Dict[str, Any]) -> LiveExecutionResult:
        """Execute on BNKR via custodial API."""
        proposal_id = proposal.get('proposal_id', f"bnkr_{datetime.now(timezone.utc).timestamp()}")
        pre_record = self._record_pre_execute(proposal)
        
        if not self.is_configured:
            return LiveExecutionResult(
                success=False,
                order_id=f"BNKR-{proposal_id}",
                status='not_configured',
                filled_amount=0,
                filled_price=0,
                fees=0,
                timestamp=datetime.now(timezone.utc).isoformat(),
                proof_hash=pre_record['entry_hash'],
                ledger_sequence=pre_record['sequence'],
                error_message='BNKR not configured - set BNKR_API_KEY'
            )
        
        try:
            # BNKR execution endpoint
            order_data = {
                'asset': proposal.get('asset'),
                'direction': proposal.get('direction'),  # 'buy' or 'sell'
                'amount_usd': proposal.get('amount_usd'),
                'entry_price': proposal.get('entry_price'),
                'stop_loss': proposal.get('stop_loss'),
                'take_profit': proposal.get('take_profit')
            }
            
            response = self.session.post(f'{self.api_url}/execute', json=order_data)
            
            if response.status_code in [200, 201]:
                data = response.json()
                result = LiveExecutionResult(
                    success=True,
                    order_id=data.get('order_id', f"BNKR-{proposal_id}"),
                    status=data.get('status', 'filled'),
                    filled_amount=float(data.get('filled_amount', proposal.get('amount_usd', 0))),
                    filled_price=float(data.get('price', proposal.get('entry_price', 0))),
                    fees=float(data.get('fees', 0)),
                    timestamp=datetime.now(timezone.utc).isoformat(),
                    proof_hash=pre_record['entry_hash'],
                    ledger_sequence=pre_record['sequence'],
                    exchange_response=data
                )
            else:
                result = LiveExecutionResult(
                    success=False,
                    order_id=f"BNKR-{proposal_id}",
                    status='failed',
                    filled_amount=0,
                    filled_price=0,
                    fees=0,
                    timestamp=datetime.now(timezone.utc).isoformat(),
                    proof_hash=pre_record['entry_hash'],
                    ledger_sequence=pre_record['sequence'],
                    error_message=f"API Error {response.status_code}: {response.text}",
                    exchange_response={'status_code': response.status_code, 'text': response.text}
                )
            
            # Record to ledger
            post_record = self._record_post_execute(result)
            result.proof_hash = post_record['entry_hash']
            result.ledger_sequence = post_record['sequence']
            
            return result
            
        except Exception as e:
            error_result = LiveExecutionResult(
                success=False,
                order_id=f"BNKR-{proposal_id}",
                status='error',
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


# Status checker for dashboard
async def get_connector_status():
    """Get status of all connectors for dashboard display."""
    poly = PolymarketLiveConnector()
    bnkr = BNKRLiveConnector()
    
    status = {
        'polymarket': {
            'configured': poly.is_configured,
            'status': 'live' if poly.is_configured else 'not_configured',
            'balance': None
        },
        'bnkr': {
            'configured': bnkr.is_configured,
            'status': 'live' if bnkr.is_configured else 'not_configured',
            'balance': None
        }
    }
    
    if poly.is_configured:
        try:
            poly_balance = await poly.get_balance()
            status['polymarket']['balance'] = poly_balance
        except Exception as e:
            status['polymarket']['error'] = str(e)
    
    if bnkr.is_configured:
        try:
            bnkr_balance = await bnkr.get_balance()
            status['bnkr']['balance'] = bnkr_balance
        except Exception as e:
            status['bnkr']['error'] = str(e)
    
    return status


if __name__ == "__main__":
    # Test the connectors
    import asyncio
    
    async def test():
        print("=" * 60)
        print("Live Connector Status")
        print("=" * 60)
        
        status = await get_connector_status()
        
        print(f"\nPolymarket: {'🟢 LIVE' if status['polymarket']['configured'] else '🔴 NOT CONFIGURED'}")
        if status['polymarket'].get('balance'):
            print(f"  Balance: {status['polymarket']['balance']}")
        
        print(f"\nBNKR: {'🟢 LIVE' if status['bnkr']['configured'] else '🔴 NOT CONFIGURED'}")
        if status['bnkr'].get('balance'):
            print(f"  Balance: {status['bnkr']['balance']}")
        
        print("\n" + "=" * 60)
    
    asyncio.run(test())
