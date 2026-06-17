import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import os from 'os';

let db;

/**
 * 初始化資料庫結構（同步執行，僅在建立資料庫時呼叫）
 */
function initializeSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS resumes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_name TEXT,
      raw_text TEXT,
      parsed_json TEXT,
      is_active INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      company TEXT NOT NULL,
      location TEXT,
      salary TEXT,
      url TEXT,
      description TEXT,
      source TEXT,
      status TEXT DEFAULT 'Interested',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS job_analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL,
      resume_id INTEGER NOT NULL,
      match_score INTEGER,
      match_analysis TEXT,
      cover_letter TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE CASCADE,
      FOREIGN KEY (resume_id) REFERENCES resumes (id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_resumes_is_active ON resumes(is_active);
    CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
    CREATE INDEX IF NOT EXISTS idx_job_analyses_job_id ON job_analyses(job_id);
    CREATE INDEX IF NOT EXISTS idx_job_analyses_resume_id ON job_analyses(resume_id);
  `);

  try {
    database.exec(`ALTER TABLE jobs ADD COLUMN ai_summary TEXT;`);
  } catch (err) {
    // Ignore if column already exists
  }
}

/**
 * Promise‑based helpers that wrap better‑sqlite3's synchronous API.
 */
function _run(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    const info = stmt.run(...params);
    return { lastID: info.lastInsertRowid, lastInsertRowid: info.lastInsertRowid, changes: info.changes };
  } catch (err) {
    throw err;
  }
}

function _get(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      const stmt = db.prepare(sql);
      const row = stmt.get(...params);
      resolve(row);
    } catch (err) {
      reject(err);
    }
  });
}

function _all(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      const stmt = db.prepare(sql);
      const rows = stmt.all(...params);
      resolve(rows);
    } catch (err) {
      reject(err);
    }
  });
}

function _exec(sql) {
  return new Promise((resolve, reject) => {
    try {
      db.exec(sql);
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Compatibility layer – mimics the subset of better‑sqlite3 that the project uses.
 * - `prepare(sql)` returns an object with async `all(params)`, `run(params)` and `get(params)`.
 * - `transaction(fn)` simply invokes the supplied function synchronously (no real transaction).
 */
function prepare(sql) {
  return {
    all: (...params) => _all(sql, params),
    get: (...params) => _get(sql, params),
    run: (...params) => _run(sql, params),
  };
}

function transaction(fn) {
  // Better‑sqlite3 supports transactions via db.transaction, but for simplicity we call directly.
  return fn();
}

// Initialise the database instance synchronously based on environment.
function initDb() {
  if (process.env.NODE_ENV === 'test' && !process.env.GETAJOB_DB_DIR) {
    const dbPath = process.env.GETAJOB_DB_PATH || ':memory:';
    db = new Database(dbPath);
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');
    initializeSchema(db);
  } else {
    const dbDir = process.env.GETAJOB_DB_DIR || path.join(os.homedir(), '.getajob');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    const dbPath = path.join(dbDir, 'getajob.db');
    if (!global.cachedDb) {
      const newDb = new Database(dbPath);
      newDb.pragma('foreign_keys = ON');
      newDb.pragma('busy_timeout = 5000');
      initializeSchema(newDb);
      global.cachedDb = newDb;
    }
    db = global.cachedDb;
  }
}

initDb();

export default db;
export { prepare, transaction, _run as run, _get as get, _all as all, _exec as exec };
