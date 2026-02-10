const { Web3 } = require('web3');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load .env from root
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

async function deploy() {
    try {
        console.log('🚀 Starting ChainShield Recovery Deployment...');

        // Connect to Ganache
        // We use localhost because we are running this script from the HOST machine
        // which maps localhost:7546 -> container:8545
        const rpcUrl = 'http://127.0.0.1:7546';
        console.log(`📡 Connecting to ${rpcUrl}...`);

        const web3 = new Web3(rpcUrl);

        // Verify connection
        try {
            const netId = await web3.eth.net.getId();
            console.log(`✅ Connected to network ID: ${netId}`);
        } catch (e) {
            console.error(`❌ Coud not connect to ${rpcUrl}. Is Docker Ganache running?`);
            console.error(`Error: ${e.message}`);
            process.exit(1);
        }

        // Get accounts
        const accounts = await web3.eth.getAccounts();
        if (accounts.length === 0) {
            throw new Error('No accounts found in Ganache');
        }

        const deployer = accounts[0];
        console.log(`👤 Deploying from: ${deployer}`);
        const balance = await web3.eth.getBalance(deployer);
        console.log(`💰 Balance: ${web3.utils.fromWei(balance, 'ether')} ETH`);

        // Load artifact
        const artifactPath = path.resolve(__dirname, '../../contracts/build/contracts/ChainShield.json');
        if (!fs.existsSync(artifactPath)) {
            throw new Error(`Artifact not found at ${artifactPath}`);
        }

        console.log('📄 Loading contract artifact...');
        const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
        const { abi, bytecode } = artifact;

        // Deploy
        console.log('📦 Deploying contract...');
        const contract = new web3.eth.Contract(abi);

        const deployTx = contract.deploy({ data: bytecode });
        const estimatedGas = await deployTx.estimateGas({ from: deployer });

        const instance = await deployTx.send({
            from: deployer,
            gas: Math.floor(Number(estimatedGas) * 1.2), // Add buffer
            gasPrice: await web3.eth.getGasPrice()
        });

        const newAddress = instance.options.address;
        console.log(`\n✅ Contract Deployed Successfully!`);
        console.log(`📍 Address: ${newAddress}`);

        // Update .env file
        console.log('\n📝 Updating .env file...');
        let envContent = fs.readFileSync(envPath, 'utf8');

        // Update CONTRACT_ADDRESS
        // Regex to replace existing or add if missing
        const contractRegex = /^CONTRACT_ADDRESS=.*$/m;
        if (contractRegex.test(envContent)) {
            envContent = envContent.replace(contractRegex, `CONTRACT_ADDRESS=${newAddress}`);
        } else {
            envContent += `\nCONTRACT_ADDRESS=${newAddress}`;
        }

        // Update RPC URL back to internal if needed? 
        // No, we keep it as 'http://ganache:8545' for internal docker use.
        // But if the user runs this script, they are on host.
        // The script doesn't change RPC URL in .env unless we want to.
        // We should ensure BLOCKCHAIN_ACCOUNT matches deployer

        const accountRegex = /^BLOCKCHAIN_ACCOUNT=.*$/m;
        if (accountRegex.test(envContent)) {
            envContent = envContent.replace(accountRegex, `BLOCKCHAIN_ACCOUNT=${deployer}`);
        }

        fs.writeFileSync(envPath, envContent);
        console.log('✅ .env updated');

        console.log('\n🎉 RECOVERY COMPLETE!');
        console.log('Please restart your backend:');
        console.log('  docker compose restart backend');

    } catch (error) {
        console.error('❌ Deployment Failed:', error);
        process.exit(1);
    }
}

deploy();
