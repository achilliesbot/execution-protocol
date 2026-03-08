const { ethers } = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying contracts with account:', deployer.address);
  console.log('Account balance:', (await ethers.provider.getBalance(deployer.address)).toString());

  // Deploy ExecutionFeeCollector
  console.log('\n📦 Deploying ExecutionFeeCollector...');
  
  const ExecutionFeeCollector = await ethers.getContractFactory('ExecutionFeeCollector');
  const feeCollector = await ExecutionFeeCollector.deploy(deployer.address);
  await feeCollector.waitForDeployment();
  
  const feeCollectorAddress = await feeCollector.getAddress();
  console.log('✅ ExecutionFeeCollector deployed to:', feeCollectorAddress);
  
  // Deploy ATTESTRegistry
  console.log('\n📦 Deploying ATTESTRegistry...');
  
  const ATTESTRegistry = await ethers.getContractFactory('ATTESTRegistry');
  const attestRegistry = await ATTESTRegistry.deploy();
  await attestRegistry.waitForDeployment();
  
  const attestAddress = await attestRegistry.getAddress();
  console.log('✅ ATTESTRegistry deployed to:', attestAddress);
  
  // Set fee collector as authorized executor on ATTEST (if needed)
  console.log('\n🔗 Setting up contract relationships...');
  
  // Authorize deployer as executor
  await feeCollector.authorizeExecutor(deployer.address);
  console.log('✅ Deployer authorized as executor');
  
  // Set fee parameters: 0.5% or 0.01 ETH
  await feeCollector.setFeeParameters(50, ethers.parseEther('0.01'));
  console.log('✅ Fee parameters set: 0.5% or 0.01 ETH');
  
  console.log('\n🎉 Deployment complete!');
  console.log('\nContract Addresses:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('ExecutionFeeCollector:', feeCollectorAddress);
  console.log('ATTESTRegistry:', attestAddress);
  console.log('Deployer:', deployer.address);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  // Save deployment info
  const deploymentInfo = {
    network: 'baseSepolia',
    chainId: 84532,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      ExecutionFeeCollector: feeCollectorAddress,
      ATTESTRegistry: attestAddress,
    },
  };
  
  const fs = require('fs');
  fs.writeFileSync('deployment.json', JSON.stringify(deploymentInfo, null, 2));
  console.log('\n📝 Deployment info saved to deployment.json');
  
  // Wait for block confirmations
  console.log('\n⏳ Waiting for block confirmations...');
  await new Promise(resolve => setTimeout(resolve, 30000));
  
  // Verify contracts if API key is set
  if (process.env.BASESCAN_API_KEY) {
    console.log('\n🔍 Verifying contracts on Basescan...');
    
    try {
      await hre.run('verify:verify', {
        address: feeCollectorAddress,
        constructorArguments: [deployer.address],
      });
      console.log('✅ ExecutionFeeCollector verified');
    } catch (error) {
      console.log('⚠️ ExecutionFeeCollector verification failed:', error.message);
    }
    
    try {
      await hre.run('verify:verify', {
        address: attestAddress,
        constructorArguments: [],
      });
      console.log('✅ ATTESTRegistry verified');
    } catch (error) {
      console.log('⚠️ ATTESTRegistry verification failed:', error.message);
    }
  }
  
  console.log('\n✨ All done!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
