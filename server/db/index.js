// ============================================================
// SQLite Database Initialization
// Mirrors Supabase schema exactly for local development
// ============================================================

const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'local.db');

let db = null;

async function getDb() {
  if (db) return db;

  const SQL = await initSqlJs();

  // Load existing DB or create new one
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Enable WAL mode for better concurrent reads
  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA foreign_keys = ON');

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      id TEXT PRIMARY KEY,
      nickname TEXT NOT NULL,
      avatar_url TEXT NOT NULL,
      balance REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS stories (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT NOT NULL,
      pain_level INTEGER NOT NULL CHECK (pain_level BETWEEN 1 AND 10),
      price REAL NOT NULL CHECK (price BETWEEN 0.99 AND 9.99),
      author_id TEXT NOT NULL REFERENCES user_profiles(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      buy_count INTEGER NOT NULL DEFAULT 0,
      comfort_count INTEGER NOT NULL DEFAULT 0,
      is_published INTEGER NOT NULL DEFAULT 1
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      story_id TEXT NOT NULL REFERENCES stories(id),
      buyer_id TEXT NOT NULL REFERENCES user_profiles(id),
      seller_id TEXT NOT NULL REFERENCES user_profiles(id),
      price REAL NOT NULL CHECK (price > 0),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS comforts (
      id TEXT PRIMARY KEY,
      story_id TEXT NOT NULL REFERENCES stories(id),
      sender_id TEXT NOT NULL REFERENCES user_profiles(id),
      type TEXT NOT NULL CHECK (type IN ('tea', 'flower', 'bandage')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Create indexes
  db.run('CREATE INDEX IF NOT EXISTS idx_stories_author ON stories(author_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_stories_category ON stories(category)');
  db.run('CREATE INDEX IF NOT EXISTS idx_stories_created ON stories(created_at DESC)');
  db.run('CREATE INDEX IF NOT EXISTS idx_stories_pain ON stories(pain_level DESC)');
  db.run('CREATE INDEX IF NOT EXISTS idx_tx_story ON transactions(story_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_tx_buyer ON transactions(buyer_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_tx_seller ON transactions(seller_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_comforts_story ON comforts(story_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_comforts_sender ON comforts(sender_id)');

  console.log('[DB] SQLite initialized at', DB_PATH);
  return db;
}

function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

// Auto-save every 5 seconds if there are changes
let dirty = false;
setInterval(() => {
  if (dirty) {
    saveDb();
    dirty = false;
  }
}, 5000);

process.on('exit', saveDb);
process.on('SIGINT', () => { saveDb(); process.exit(); });
process.on('SIGTERM', () => { saveDb(); process.exit(); });

function markDirty() { dirty = true; }

// Helper: run query and return all rows as objects
function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

// Helper: run query and return first row
function get(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  let row = null;
  if (stmt.step()) {
    row = stmt.getAsObject();
  }
  stmt.free();
  return row;
}

// Helper: run statement
function run(sql, params = []) {
  db.run(sql, params);
  markDirty();
}

module.exports = { getDb, all, get, run, saveDb, markDirty };
