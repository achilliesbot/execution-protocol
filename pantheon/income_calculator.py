#!/usr/bin/env python3
"""
Income Calculator - Real-time income stream calculations
Calculates earnings from BNKR, Polymarket, Execution Protocol, and other streams
"""

import os
import sys
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Dict, Any

class IncomeCalculator:
    """Calculate real-time income from all streams"""
    
    def __init__(self):
        self.trades_file = "/home/ubuntu/polymarket-trader/trades.jsonl"
        self.ledger_dir = "/data/.openclaw/workspace/execution-protocol/data/ledger"
        
    def calculate_bnk_income(self) -> Dict[str, Any]:
        """Calculate BNKR trading income"""
        try:
            if not Path(self.trades_file).exists():
                return {"total": 0, "daily": 0, "trades": 0}
            
            with open(self.trades_file, 'r') as f:
                trades = [json.loads(line) for line in f if line.strip()]
            
            # Filter BNKR trades
            bnk_trades = [t for t in trades if 'bnk' in t.get('proposal', {}).get('asset', '').lower()]
            
            total_deployed = sum(t['proposal']['amount_usd'] for t in bnk_trades if 'proposal' in t)
            
            # Calculate P&L (simplified - would need actual market data for real P&L)
            # For now, show deployed capital as "at risk" capital
            return {
                "total": round(total_deployed, 2),
                "daily": 0,  # Would calculate from daily changes
                "trades": len(bnk_trades),
                "stream": "BNKR Trading"
            }
        except Exception as e:
            print(f"Error calculating BNK income: {e}")
            return {"total": 0, "daily": 0, "trades": 0, "stream": "BNKR Trading"}
    
    def calculate_polymarket_income(self) -> Dict[str, Any]:
        """Calculate Polymarket trading income"""
        try:
            if not Path(self.trades_file).exists():
                return {"total": 0, "daily": 0, "trades": 0}
            
            with open(self.trades_file, 'r') as f:
                trades = [json.loads(line) for line in f if line.strip()]
            
            # Filter Polymarket trades (assets starting with 'pm')
            pm_trades = [t for t in trades if t.get('proposal', {}).get('asset', '').startswith('pm')]
            
            total_deployed = sum(t['proposal']['amount_usd'] for t in pm_trades if 'proposal' in t)
            
            return {
                "total": round(total_deployed, 2),
                "daily": 0,
                "trades": len(pm_trades),
                "stream": "Polymarket Trading"
            }
        except Exception as e:
            print(f"Error calculating Polymarket income: {e}")
            return {"total": 0, "daily": 0, "trades": 0, "stream": "Polymarket Trading"}
    
    def calculate_ep_income(self) -> Dict[str, Any]:
        """Calculate Execution Protocol fee income"""
        try:
            # Count validations from ledger
            validation_count = 0
            fee_total = 0
            
            if Path(self.ledger_dir).exists():
                for ledger_file in Path(self.ledger_dir).glob("*.jsonl"):
                    with open(ledger_file, 'r') as f:
                        for line in f:
                            try:
                                entry = json.loads(line)
                                if entry.get('entry_type') == 'validation':
                                    validation_count += 1
                                    # Assume $0.10 fee per validation
                                    fee_total += 0.10
                            except:
                                pass
            
            return {
                "total": round(fee_total, 2),
                "validations": validation_count,
                "stream": "Execution Protocol"
            }
        except Exception as e:
            print(f"Error calculating EP income: {e}")
            return {"total": 0, "validations": 0, "stream": "Execution Protocol"}
    
    def get_all_income(self) -> Dict[str, Any]:
        """Get income from all streams"""
        bnk = self.calculate_bnk_income()
        polymarket = self.calculate_polymarket_income()
        ep = self.calculate_ep_income()
        
        total = bnk.get('total', 0) + polymarket.get('total', 0) + ep.get('total', 0)
        
        return {
            "bnk": bnk,
            "polymarket": polymarket,
            "ep": ep,
            "total": round(total, 2),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

if __name__ == "__main__":
    calc = IncomeCalculator()
    income = calc.get_all_income()
    print(json.dumps(income, indent=2))
