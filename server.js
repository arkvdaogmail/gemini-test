require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Stripe = require('stripe');
const { Transaction, secp256k1 } = require('thor-devkit');
const axios = require('axios');
const multer = require('multer');

// --- CONFIGURATION ---
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const app = express();
app.use(cors());
app.use(express.json());
const upload = multer({ storage: multer.memoryStorage() }); // Handles file uploads in memory

// === 1. Endpoint to provide the public Stripe key to the front-end ===
app.get('/config', (req, res) => {
    res.json({ stripePublicKey: process.env.STRIPE_PUBLIC_KEY });
});

// === 2. Endpoint to create a payment intent ===
app.post('/create-payment', async (req, res) => {
    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount: 199, // $1.99 in cents
            currency: 'usd',
            metadata: { document_hash: req.body.document_hash },
        });
        res.json({ clientSecret: paymentIntent.client_secret });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// === 3. Endpoint to notarize the document after successful payment ===
app.post('/notarize', upload.single('document'), async (req, res) => {
    try {
        const documentHash = '0x' + req.body.document_hash;
        
        // --- VECHAIN LOGIC ---
        const originPrivateKey = Buffer.from(process.env.PRIVATE_KEY.slice(2), 'hex');
        const clauses = [{ to: process.env.CONTRACT_ADDRESS, value: 0, data: documentHash }];
        
        const latestBlock = await axios.get(`${process.env.NODE_URL}/blocks/latest`);
        const txBody = new Transaction.Body({
            chainTag: parseInt(latestBlock.data.id.slice(2, 4), 16),
            blockRef: latestBlock.data.id.slice(0, 18),
            expiration: 32,
            clauses,
            gasPriceCoef: 128,
            gas: 50000,
            dependsOn: null,
            nonce: Date.now(),
        });

        const signature = secp256k1.sign(txBody.hash(), originPrivateKey);
        const tx = new Transaction({ ...txBody, signature });
        const rawTx = '0x' + tx.encode().toString('hex');
        
        const broadcastResult = await axios.post(`${process.env.NODE_URL}/transactions`, { raw: rawTx });
        const txID = broadcastResult.data.id;

        // Wait 12 seconds for the transaction to be included in a block
        await new Promise(resolve => setTimeout(resolve, 12000)); 
        
        const receiptRes = await axios.get(`${process.env.NODE_URL}/transactions/${txID}/receipt`);
        if (!receiptRes.data || receiptRes.data.reverted) {
            throw new Error('Transaction failed on the VeChain network.');
        }

        res.json({
            success: true,
            vechainTx: txID,
            explorerUrl: `https://explore-testnet.vechain.org/transactions/${txID}`,
            documentHash: req.body.document_hash,
            blockNumber: receiptRes.data.meta.blockNumber,
        });

    } catch (error) {
        console.error("Notarization failed:", error.message);
        res.status(500).json({ success: false, details: 'Failed to create VeChain transaction.' });
    }
});

// --- Start the server ---
const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
