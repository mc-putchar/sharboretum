// Express.js server for Sharboretum: Authentication stub, Heartbeat, Sharbor state, Social action
const path = require('path');
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

// Load env if present (optional)
try {
    require('dotenv').config({ path: path.join(__dirname, '.env') });
} catch (e) {
    // dotenv not required; continue
}

const { init, ensureUser, updateHeartbeat, getSharborState, applySocialAction } = require('./db');

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
const SHARED_SECRET = process.env.SHARED_SECRET || 'dev_shared_secret'; // Set a strong secret in production
const HEARTBEAT_REWARD = process.env.HEARTBEAT_REWARD ? Number(process.env.HEARTBEAT_REWARD) : 1;

const app = express();
app.use(cors());
app.use(express.json());

// Mock verification function stub for TON Connect / Telegram Mini App initial data
function verifyTonAuth(payload) {
    // TODO: Implement real verification:
    // - TON Connect: verify proof (address, timestamp, app public key, signature) per TON Connect 2.0.
    // - Telegram Mini App: verify initData hash using Bot Token and HMAC-SHA256 per Telegram guidelines.
    // - Ensure timestamp freshness and nonce replay protection.
    // For now, we mock as always valid.
    return true;
}

// Utility: compute heartbeat leaf hash SHA256(TON_Address | Timestamp | Shared_Secret_Key)
function computeHeartbeatLeaf(tonAddress, timestamp, secret) {
    const canonicalAddr = String(tonAddress).trim();
    const ts = Number(timestamp);
    const buf = Buffer.from(`${canonicalAddr}|${ts}|${secret}`, 'utf8');
    return crypto.createHash('sha256').update(buf).digest('hex');
}

// Healthcheck
app.get('/api/health', (_req, res) => {
    res.json({ ok: true, ts: Math.floor(Date.now() / 1000) });
});

// Heartbeat endpoint
// Body: { ton_address: string, auth_payload?: any, timestamp?: number }
// Returns: { shard_balance: number, leaf_hash: string, timestamp: number }
app.post('/api/heartbeat', async (req, res) => {
    try {
        const { ton_address, auth_payload, timestamp } = req.body || {};
        if (!ton_address) {
            return res.status(400).json({ error: 'ton_address is required' });
        }

        // Verify authenticity (stubbed)
        const isValid = verifyTonAuth({ ton_address, auth_payload });
        if (!isValid) {
            return res.status(401).json({ error: 'Unauthorized: invalid TON auth payload' });
        }

        // Ensure user exists
        await ensureUser(ton_address);

        // Use provided timestamp if numeric, else current unix seconds
        const ts = typeof timestamp === 'number' ? timestamp : Math.floor(Date.now() / 1000);

        // Compute leaf hash
        const leafHash = computeHeartbeatLeaf(ton_address, ts, SHARED_SECRET);

        // Record heartbeat and update shard balance
        const shard_balance = await updateHeartbeat(ton_address, ts, leafHash, HEARTBEAT_REWARD);

        return res.json({
            shard_balance,
            leaf_hash: leafHash,
            timestamp: ts,
        });
    } catch (err) {
        console.error('Heartbeat error:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Sharbor state retrieval
// Params: :ton_address
// Returns: { ton_address, shard_balance, health, growth_percent, mutation_score, last_heartbeat }
app.get('/api/sharbor-state/:ton_address', async (req, res) => {
    try {
        const ton_address = req.params.ton_address;
        if (!ton_address) {
            return res.status(400).json({ error: 'ton_address param is required' });
        }
        const state = await getSharborState(ton_address);
        return res.json(state);
    } catch (err) {
        console.error('Sharbor state error:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * Social Action API: "water" to boost mutation_score with viral loop guard.
 * Body: { sender_address: string, receiver_address: string }
 * Logic: If not already watered today, increment receiver's mutation_score by 5.
 * Viral Loop Check: Limit 1 water per receiver per UTC day.
 * Returns: { receiver_address, mutation_score, applied, timestamp }
 */
app.post('/api/social-action', async (req, res) => {
    try {
        const { sender_address, receiver_address } = req.body || {};
        if (!sender_address || !receiver_address) {
            return res.status(400).json({ error: 'sender_address and receiver_address are required' });
        }
        if (String(sender_address).trim() === String(receiver_address).trim()) {
            return res.status(400).json({ error: 'sender_address must differ from receiver_address' });
        }

        // Apply social action with fixed delta = 5 per spec
        const result = await applySocialAction(sender_address, receiver_address, 5);

        return res.json({
            receiver_address,
            mutation_score: result.mutation_score,
            applied: result.applied,
            timestamp: result.timestamp,
        });
    } catch (err) {
        console.error('Social action error:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Bootstrap and listen
(async () => {
    try {
        await init();
        app.listen(PORT, () => {
            console.log(`Sharboretum server listening on http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error('Failed to initialize DB or start server:', err);
        process.exit(1);
    }
})();
