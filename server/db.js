// SQLite setup and data access layer for Sharboretum
// Provides: init(), ensureUser(), updateHeartbeat(), getSharborState(), applySocialAction(), queryHeartbeatsSince()

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'sharboretum.db');
const db = new sqlite3.Database(DB_PATH);

// Promisified helpers
function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) return reject(err);
            resolve(this);
        });
    });
}

function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) return reject(err);
            resolve(row || null);
        });
    });
}

function all(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows || []);
        });
    });
}

// Schema utilities
async function tableInfo(table) {
    return await all(`PRAGMA table_info(${table})`);
}

async function columnExists(table, column) {
    const info = await tableInfo(table);
    return Array.isArray(info) && info.some((c) => c.name === column);
}

async function addColumnIfMissing(table, columnDefSql) {
    const [columnName] = columnDefSql.trim().split(/\s+/);
    if (!(await columnExists(table, columnName))) {
        await run(`ALTER TABLE ${table} ADD COLUMN ${columnDefSql}`);
    }
}

// Initialize schema
async function init() {
    // Users hold off-chain Sharbor state
    await run(`
    CREATE TABLE IF NOT EXISTS users (
      ton_address TEXT PRIMARY KEY,
      shard_balance INTEGER NOT NULL DEFAULT 0,
      health INTEGER NOT NULL DEFAULT 100,
      growth_percent REAL NOT NULL DEFAULT 0,
      mutation_score INTEGER NOT NULL DEFAULT 0,
      last_heartbeat INTEGER
    )
  `);

    // Heartbeats store timestamped leaf hashes for Merkle commitments
    await run(`
    CREATE TABLE IF NOT EXISTS heartbeats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ton_address TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      leaf_hash TEXT NOT NULL,
      FOREIGN KEY (ton_address) REFERENCES users(ton_address)
    )
  `);

    await run(`CREATE INDEX IF NOT EXISTS idx_heartbeats_timestamp ON heartbeats(timestamp)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_heartbeats_address ON heartbeats(ton_address)`);

    // Social actions audit trail
    await run(`
    CREATE TABLE IF NOT EXISTS social_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender TEXT NOT NULL,
      receiver TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      mutation_delta INTEGER NOT NULL DEFAULT 1
    )
  `);

    await run(`CREATE INDEX IF NOT EXISTS idx_social_receiver ON social_actions(receiver)`);

    // Ensure new columns exist on users table per spec
    await addColumnIfMissing('users', 'telegram_id INTEGER');
    await addColumnIfMissing('users', 'last_heartbeat_time INTEGER');

    // Sharbor table per spec
    await run(`
    CREATE TABLE IF NOT EXISTS sharbors (
      nft_address TEXT PRIMARY KEY,
      owner_address TEXT,
      parent_nft_address TEXT,
      growth_progress INTEGER DEFAULT 0,
      health_status REAL DEFAULT 1.0,
      fertility_score INTEGER,
      aesthetics_type TEXT
    )
  `);
    await run('CREATE INDEX IF NOT EXISTS idx_sharbors_owner ON sharbors(owner_address)');
    await run('CREATE INDEX IF NOT EXISTS idx_sharbors_parent ON sharbors(parent_nft_address)');
}

/**
 * Ensures a user exists with default Sharbor state.
 */
async function ensureUser(ton_address) {
    const existing = await get(`SELECT ton_address FROM users WHERE ton_address = ?`, [ton_address]);
    if (!existing) {
        await run(
            `INSERT INTO users (ton_address, shard_balance, health, growth_percent, mutation_score, last_heartbeat)
       VALUES (?, 0, 100, 0, 0, NULL)`,
            [ton_address],
        );
    }
}

/**
 * Records heartbeat: inserts heartbeat row, updates user shard balance and last_heartbeat/last_heartbeat_time.
 * Returns updated shard_balance.
 */
async function updateHeartbeat(ton_address, timestamp, leaf_hash, reward = 1) {
    await run(
        `INSERT INTO heartbeats (ton_address, timestamp, leaf_hash)
     VALUES (?, ?, ?)`,
        [ton_address, timestamp, leaf_hash],
    );

    await run(
        `UPDATE users
     SET shard_balance = shard_balance + ?, last_heartbeat = ?, last_heartbeat_time = ?
     WHERE ton_address = ?`,
        [reward, timestamp, timestamp, ton_address],
    );

    const user = await get(`SELECT shard_balance FROM users WHERE ton_address = ?`, [ton_address]);
    return user ? user.shard_balance : 0;
}

/**
 * Retrieves Sharbor state for a user; ensures user exists.
 */
async function getSharborState(ton_address) {
  await ensureUser(ton_address);
  const user = await get(
    `SELECT ton_address, shard_balance, health, growth_percent, mutation_score, last_heartbeat
     FROM users WHERE ton_address = ?`,
        [ton_address],
    );
    return user;
}

/**
 * Applies a social action ("water"): increments receiver's mutation_score and logs the action.
 * Viral loop guard: limit one water per receiver per UTC day.
 * Returns { mutation_score, applied: boolean, timestamp } for the receiver.
 */
async function applySocialAction(sender, receiver, mutation_delta = 5, timestamp) {
    const ts = typeof timestamp === 'number' ? timestamp : Math.floor(Date.now() / 1000);
    const dayStart = Math.floor(ts / 86400) * 86400;

    await ensureUser(receiver);

    // Check if this receiver already got watered today (global limit)
    const existing = await get(
        `SELECT id FROM social_actions
     WHERE receiver = ? AND timestamp >= ?`,
        [receiver, dayStart],
    );

    if (existing) {
        // No-op, return current score without increment
        const userNoop = await get(`SELECT mutation_score FROM users WHERE ton_address = ?`, [receiver]);
        return { mutation_score: userNoop ? userNoop.mutation_score : 0, applied: false, timestamp: ts };
    }

    // Log action and apply mutation increment
    await run(
        `INSERT INTO social_actions (sender, receiver, timestamp, mutation_delta)
     VALUES (?, ?, ?, ?)`,
        [sender, receiver, ts, mutation_delta],
    );

    await run(`UPDATE users SET mutation_score = mutation_score + ? WHERE ton_address = ?`, [mutation_delta, receiver]);

    const user = await get(`SELECT mutation_score FROM users WHERE ton_address = ?`, [receiver]);
    return { mutation_score: user ? user.mutation_score : 0, applied: true, timestamp: ts };
}

/**
 * Query heartbeat leaf hashes since a given unix timestamp.
 */
async function queryHeartbeatsSince(sinceTimestamp) {
    const rows = await all(
        `SELECT id, ton_address, timestamp, leaf_hash
     FROM heartbeats
     WHERE timestamp >= ?
     ORDER BY timestamp ASC`,
        [sinceTimestamp],
    );
    return rows;
}

module.exports = {
    db,
    // export helpers for scripts
    run,
    get,
    all,
    // exported API
    init,
    ensureUser,
    updateHeartbeat,
    getSharborState,
    applySocialAction,
    queryHeartbeatsSince,
};
