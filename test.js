import { ThorClient, cry, Transaction, secp256k1 } from '@vechain/sdk-core';

async function runTest() {
    console.log("Engine test started on GitHub Actions...");
    try {
        const mnemonic = process.env.VECHAIN_MNEMONIC;
        if (!mnemonic) {
            throw new Error("Secret VECHAIN_MNEMONIC not found.");
        }
        
        const documentHash = '0x' + 'a'.repeat(64);

        console.log("Connecting to VeChain Testnet...");
        const client = new ThorClient('https://testnet.vechain.org');

        console.log("Creating wallet...");
        const privateKey = cry.mnemonic.toPrivateKey(mnemonic.split(' '));
        const address = cry.secp256k1.deriveAddress(privateKey);
        
        console.log("Building transaction...");
        const bestBlock = await client.blocks.getBestBlock();
        const genesisBlock = await client.blocks.getGenesisBlock();
        const txBody = {
            chainTag: parseInt(genesisBlock.id.slice(-2), 16),
            blockRef: bestBlock.id.slice(0, 18),
            expiration: 32,
            clauses: [{ to: address, value: '0x0', data: documentHash }],
            gasPriceCoef: 0,
            gas: 21000,
            dependsOn: null,
            nonce: Date.now(),
        };

        const tx = new Transaction(txBody);
        tx.signature = secp256k1.sign(tx.getSigningHash(), privateKey);

        console.log("Sending transaction...");
        const { id } = await client.transactions.sendTransaction('0x' + tx.encode().toString('hex'));

        console.log("\n✅ SUCCESS! The engine works.");
        console.log(`Transaction ID: ${id}`);
    } catch (error) {
        console.error("\n❌ ENGINE FAILED:", error.message);
        process.exit(1); // Exit with an error code
    }
}
runTest();
