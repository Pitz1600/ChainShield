const Web3 = require('web3');
const fs = require('fs');
const path = require('path');

// Read compiled contract
const contractPath = path.join(__dirname, 'build', 'contracts', 'ChainShield.json');
let contractData;

try {
    contractData = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
} catch (error) {
    console.error('❌ Contract not compiled. Run: npx truffle compile');
    process.exit(1);
}

const abi = contractData.abi;
const bytecode = contractData.bytecode;

// Connect to Ganache
const web3 = new Web3('http://127.0.0.1:8545');

async function deploy() {
    try {
        console.log('🚀 Starting ChainShield deployment...\n');

        // Get accounts
        const accounts = await web3.eth.getAccounts();
        const deployer = accounts[0];

        console.log('📋 Deployment Details:');
        console.log('   Network: http://127.0.0.1:8545');
        console.log('   Deployer:', deployer);

        // Get balance
        const balance = await web3.eth.getBalance(deployer);
        console.log('   Balance:', web3.utils.fromWei(balance, 'ether'), 'ETH\n');

        // Create contract instance
        const contract = new web3.eth.Contract(abi);

        console.log('📦 Deploying contract...');

        // Deploy
        const deployedContract = await contract
            .deploy({ data: bytecode })
            .send({
                from: deployer,
                gas: 3000000,
                gasPrice: web3.utils.toWei('20', 'gwei')
            });

        const contractAddress = deployedContract.options.address;

        console.log('\n✅ Deployment Successful!\n');
        console.log('═══════════════════════════════════════════════════════');
        console.log('📍 CONTRACT ADDRESS:', contractAddress);
        console.log('═══════════════════════════════════════════════════════\n');

        console.log('📝 Update your backend/.env file with:\n');
        console.log('BLOCKCHAIN_RPC_URL=http://127.0.0.1:8545');
        console.log(`CONTRACT_ADDRESS=${contractAddress}`);
        console.log(`BLOCKCHAIN_ACCOUNT=${deployer}`);
        console.log('\n💡 To get the private key, check Ganache GUI or use:');
        console.log('   ganache accounts --detach\n');

        // Save deployment info
        const deploymentInfo = {
            contractAddress,
            deployer,
            network: 'development',
            rpcUrl: 'http://127.0.0.1:8545',
            timestamp: new Date().toISOString()
        };

        fs.writeFileSync(
            path.join(__dirname, 'deployment.json'),
            JSON.stringify(deploymentInfo, null, 2)
        );

        console.log('✅ Deployment info saved to deployment.json\n');

        // Test contract
        console.log('🧪 Testing contract...');
        const totalRecords = await deployedContract.methods.getTotalRecords().call();
        console.log('   Initial records:', totalRecords);
        console.log('   ✅ Contract is working!\n');

        process.exit(0);
    } catch (error) {
        console.error('\n❌ Deployment failed:', error.message);
        process.exit(1);
    }
}

// Check if Ganache is running
web3.eth.net.isListening()
    .then(() => {
        console.log('✅ Connected to Ganache\n');
        deploy();
    })
    .catch(() => {
        console.error('❌ Cannot connect to Ganache at http://127.0.0.1:8545');
        console.error('   Please start Ganache first:');
        console.error('   - Download Ganache GUI from https://trufflesuite.com/ganache/');
        console.error('   - Or run: ganache --detach\n');
        process.exit(1);
    });
