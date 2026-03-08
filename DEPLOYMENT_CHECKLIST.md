# Deployment Checklist

## Pre-Deployment

- [ ] Get Base Sepolia ETH from faucet
  - URL: https://www.coinbase.com/faucets/base-sepolia-faucet
  - Need: 0.1+ ETH for deployment

- [ ] Set up environment
  - [ ] Copy `.env.example` to `.env`
  - [ ] Add private key
  - [ ] Add Basescan API key (optional, for verification)

- [ ] Install dependencies
  ```bash
  npm install
  ```

## Smart Contract Deployment

- [ ] Compile contracts
  ```bash
  npx hardhat compile
  ```

- [ ] Deploy to Base Sepolia
  ```bash
  npx hardhat run scripts/deploy-testnet.js --network baseSepolia
  ```

- [ ] Record contract addresses
  - ExecutionFeeCollector: `0x...`
  - ATTESTRegistry: `0x...`

- [ ] Verify contracts on Basescan (auto if API key set)

## API Service Deployment

- [ ] Update `.env` with contract addresses
  ```
  ATTEST_CONTRACT_ADDRESS=0x...
  FEE_COLLECTOR_ADDRESS=0x...
  ```

- [ ] Test API locally
  ```bash
  npm start
  # In another terminal:
  npm test
  ```

- [ ] Deploy API (Render/Railway/VPS)
  - [ ] Create account
  - [ ] Connect GitHub repo
  - [ ] Set environment variables
  - [ ] Deploy

## Virtuals ACP Integration

- [ ] Create agent profile on Virtuals
  - [ ] Upload manifest from `VIRTUALS_ACP.md`
  - [ ] Set pricing
  - [ ] Configure endpoints

- [ ] Test ACP integration
  - [ ] Register service
  - [ ] Test validation endpoint
  - [ ] Test execution endpoint

## Post-Deployment

- [ ] Monitor first transactions
- [ ] Check attestation creation
- [ ] Verify fee collection
- [ ] Update documentation
- [ ] Announce launch

## Optional: Mainnet Deployment

- [ ] Get Base mainnet ETH
- [ ] Redeploy contracts
- [ ] Update API config
- [ ] Test with real capital

## Rollback Plan

If issues detected:
1. Pause service
2. Investigate logs
3. Fix issues
4. Redeploy if needed
5. Resume service

## Support Contacts

- **Technical:** @achillesalphaai
- **Urgent:** Telegram direct message
- **Documentation:** https://docs.execution-protocol.io
