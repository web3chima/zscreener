import dotenv from 'dotenv';
import { zcashRPCClient } from '../services/zcash-rpc-client.js';
import { getNillionClient } from '../services/nillion-client.js';
import { nearService } from '../services/near-service.js';

dotenv.config();

async function checkZcash() {
  console.log('\n--- Checking Zcash Connection ---');
  try {
    const info = await zcashRPCClient.getBlockchainInfo();
    console.log('✅ Zcash Node Connected');
    console.log(`   Chain: ${info.chain}`);
    console.log(`   Blocks: ${info.blocks}`);
    console.log(`   Best Block Hash: ${info.bestblockhash}`);
    return true;
  } catch (error: any) {
    console.error('❌ Zcash Connection Failed');
    console.error(`   Error: ${error.message}`);
    return false;
  }
}

async function checkNillion() {
  console.log('\n--- Checking Nillion (NillionAgent) Connection ---');
  try {
    const client = getNillionClient();

    // Check configuration
    const config = client.getConfig();
    if (!config.apiKey || !config.apiUser) {
      console.error('❌ Nillion Credentials Missing');
      return false;
    }

    console.log('   Configuration present. Authenticating...');
    await client.authenticate();
    console.log('✅ Nillion Authentication Successful');

    // Verify stored agent ID
    console.log(`   Agent ID: ${config.nillionAgentId}`);
    return true;
  } catch (error: any) {
    console.error('❌ Nillion Connection Failed');
    console.error(`   Error: ${error.message}`);
    return false;
  }
}

async function checkNEAR() {
  console.log('\n--- Checking NEAR Connection ---');
  try {
    const status = await nearService.getNetworkStatus();
    console.log('✅ NEAR Node Connected');
    console.log(`   Chain ID: ${status.chain_id}`);
    console.log(`   Latest Block Height: ${status.sync_info.latest_block_height}`);
    return true;
  } catch (error: any) {
    console.error('❌ NEAR Connection Failed');
    console.error(`   Error: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('Starting Network Connectivity Tests...');

  const zcashOk = await checkZcash();
  const nillionOk = await checkNillion();
  const nearOk = await checkNEAR();

  console.log('\n--- Summary ---');
  console.log(`Zcash:   ${zcashOk ? '✅' : '❌'}`);
  console.log(`Nillion: ${nillionOk ? '✅' : '❌'}`);
  console.log(`NEAR:    ${nearOk ? '✅' : '❌'}`);

  if (zcashOk && nillionOk && nearOk) {
    console.log('\nAll systems operational. Live mode ready.');
    process.exit(0);
  } else {
    console.error('\nSome systems failed checks. Review logs above.');
    process.exit(1);
  }
}

main();
