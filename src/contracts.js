// Contract integration for Execution Protocol ACP Service
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Load contract ABIs
const loadABI = (contractName) => {
  try {
    const abiPath = path.join(__dirname, '../artifacts/contracts', `${contractName}.sol`, `${contractName}.json`);
    const contractJson = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
    return contractJson.abi;
  } catch (error) {
    console.warn(`Could not load ABI for ${contractName}:`, error.message);
    return null;
  }
};

class ContractIntegration {
  constructor() {
    this.provider = null;
    this.signer = null;
    this.attestContract = null;
    this.feeCollectorContract = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    const rpcUrl = process.env.BASE_SEPOLIA_RPC || 'https://sepolia.base.org';
    const privateKey = process.env.PRIVATE_KEY;
    const attestAddress = process.env.ATTEST_CONTRACT_ADDRESS;
    const feeCollectorAddress = process.env.FEE_COLLECTOR_ADDRESS;

    if (!privateKey) {
      console.warn('⚠️ PRIVATE_KEY not set - contract integration disabled');
      return;
    }

    try {
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      this.signer = new ethers.Wallet(privateKey, this.provider);

      // Load contracts if addresses are set
      if (attestAddress) {
        const attestABI = loadABI('ATTESTRegistry');
        if (attestABI) {
          this.attestContract = new ethers.Contract(attestAddress, attestABI, this.signer);
          console.log('✅ ATTESTRegistry connected:', attestAddress);
        }
      }

      if (feeCollectorAddress) {
        const feeCollectorABI = loadABI('ExecutionFeeCollector');
        if (feeCollectorABI) {
          this.feeCollectorContract = new ethers.Contract(feeCollectorAddress, feeCollectorABI, this.signer);
          console.log('✅ ExecutionFeeCollector connected:', feeCollectorAddress);
        }
      }

      this.initialized = true;
    } catch (error) {
      console.error('❌ Contract integration failed:', error.message);
    }
  }

  // Create attestation for a decision
  async createAttestation(agentAddress, decision) {
    if (!this.attestContract) {
      console.warn('ATTEST contract not initialized');
      return null;
    }

    try {
      // Prepare attestation data
      const schema = ethers.keccak256(ethers.toUtf8Bytes('ExecutionDecision'));
      const data = ethers.AbiCoder.defaultAbiCoder().encode(
        ['string', 'uint256', 'string', 'uint256'],
        [
          decision.decision_id,
          ethers.parseUnits(decision.confidence_score.toString(), 4),
          decision.status,
          decision.max_allocation
        ]
      );

      // Create attestation transaction
      const tx = await this.attestContract.attest(
        schema,
        agentAddress,
        0, // No expiration
        ethers.ZeroHash, // No reference
        data,
        { value: ethers.parseEther('0.001') } // Attestation fee
      );

      const receipt = await tx.wait();
      
      // Extract attestation UID from event
      const event = receipt.logs.find(
        log => log.topics[0] === ethers.id('AttestationCreated(bytes32,bytes32,address,address,uint64)')
      );

      if (event) {
        const uid = event.topics[1];
        console.log('✅ Attestation created:', uid);
        return uid;
      }

      return null;
    } catch (error) {
      console.error('❌ Attestation creation failed:', error.message);
      return null;
    }
  }

  // Collect fee for execution
  async collectFee(decisionId, agentAddress, tradeValue, feeAmount) {
    if (!this.feeCollectorContract) {
      console.warn('FeeCollector contract not initialized');
      return null;
    }

    try {
      const tx = await this.feeCollectorContract.collectFee(
        decisionId,
        agentAddress,
        tradeValue,
        { value: feeAmount }
      );

      const receipt = await tx.wait();
      console.log('✅ Fee collected:', receipt.hash);
      return receipt.hash;
    } catch (error) {
      console.error('❌ Fee collection failed:', error.message);
      return null;
    }
  }

  // Get agent reputation from ATTEST
  async getAgentReputation(agentAddress) {
    if (!this.attestContract) {
      return null;
    }

    try {
      const profile = await this.attestContract.profiles(agentAddress);
      
      return {
        address: agentAddress,
        reputation_score: Number(profile.reputationScore),
        total_attestations: Number(profile.totalAttestations),
        is_verified: profile.isVerified,
        last_activity: Number(profile.lastActivityBlock)
      };
    } catch (error) {
      console.error('❌ Failed to fetch reputation:', error.message);
      return null;
    }
  }

  // Calculate fee offchain (before sending to contract)
  async calculateFee(tradeValue) {
    if (!this.feeCollectorContract) {
      // Fallback calculation
      const percentageFee = (BigInt(tradeValue) * BigInt(50)) / BigInt(10000); // 0.5%
      const flatFee = ethers.parseEther('0.01');
      
      return percentageFee > flatFee ? percentageFee : flatFee;
    }

    try {
      const [feeAmount, isFlatFee] = await this.feeCollectorContract.calculateFee(tradeValue);
      return { feeAmount, isFlatFee };
    } catch (error) {
      console.error('❌ Fee calculation failed:', error.message);
      return ethers.parseEther('0.01'); // Default to flat fee
    }
  }

  // Get contract stats
  async getContractStats() {
    const stats = {};

    if (this.feeCollectorContract) {
      try {
        stats.totalFeesCollected = ethers.formatEther(
          await this.feeCollectorContract.totalFeesCollected()
        );
        stats.feePercentage = Number(await this.feeCollectorContract.feePercentage()) / 100;
        stats.flatFeeEth = ethers.formatEther(await this.feeCollectorContract.flatFeeEth());
      } catch (error) {
        console.error('Failed to fetch fee stats:', error.message);
      }
    }

    if (this.attestContract) {
      try {
        stats.totalAttestations = Number(await this.attestContract.totalAttestations());
        stats.totalSchemas = Number(await this.attestContract.totalSchemas());
        stats.attestationFee = ethers.formatEther(await this.attestContract.attestationFee());
      } catch (error) {
        console.error('Failed to fetch attest stats:', error.message);
      }
    }

    return stats;
  }
}

module.exports = new ContractIntegration();
