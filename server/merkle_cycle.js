// Merkle Proof Generation & Commitment Script for Sharboretum
// Demonstrates the Merkle cycle:
//   a) Query all new Heartbeat leaf hashes from DB (last 6 hours)
//   b) Build Merkle Tree using SHA256
//   c) Output Merkle Root Hash
//   d) Output example Merkle Proof Path for a single user

const path = require('path');
const crypto = require('crypto');
const { MerkleTree } = require('merkletreejs');

// Load env if present (optional)
try {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
} catch (e) {
  // dotenv not required; continue
}

const { init, queryHeartbeatsSince } = require('./db');

// Hash function for merkletreejs: returns Buffer of SHA256(data)
function sha256(data) {
  return crypto.createHash('sha256').update(data).digest();
}

async function main() {
  try {
    await init();

    const now = Math.floor(Date.now() / 1000);
    const sixHours = 6 * 60 * 60;
    const sinceTs = now - sixHours;

    const rows = await queryHeartbeatsSince(sinceTs);

    if (!rows || rows.length === 0) {
      console.log(
        JSON.stringify(
          {
            message:
              'No heartbeat leaves found in the last 6 hours. Trigger /api/heartbeat to create some leaves, then rerun this script.',
            sinceTimestamp: sinceTs,
            now,
          },
          null,
          2
        )
      );
      process.exit(0);
    }

    // Convert leaf_hash hex strings to Buffer leaves
    const leaves = rows.map((r) => Buffer.from(r.leaf_hash, 'hex'));

    // Build the Merkle Tree; sortPairs for deterministic root independent of insertion order
    const tree = new MerkleTree(leaves, sha256, { sortPairs: true });

    const rootBuf = tree.getRoot();
    const merkleRootHex = rootBuf.toString('hex');

    // Pick the first user as example for proof
    const sampleRow = rows[0];
    const sampleLeaf = Buffer.from(sampleRow.leaf_hash, 'hex');
    const sampleProof = tree.getProof(sampleLeaf).map((p) => p.data.toString('hex'));

    // Verify proof
    const verified = tree.verify(tree.getProof(sampleLeaf), sampleLeaf, rootBuf);

    // Output results
    const output = {
      sinceTimestamp: sinceTs,
      leavesCount: leaves.length,
      merkleRootHex, // to be sent to the TON Merkle Root Contract
      sample: {
        ton_address: sampleRow.ton_address,
        timestamp: sampleRow.timestamp,
        leaf_hash: sampleRow.leaf_hash,
        merkleProofPath: sampleProof, // to be sent to frontend for claiming rewards
        verified,
      },
    };

    console.log(JSON.stringify(output, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Merkle cycle script error:', err);
    process.exit(1);
  }
}

main();
