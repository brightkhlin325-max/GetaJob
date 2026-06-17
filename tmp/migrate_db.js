const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const fs = require('fs');

const dbDir = process.env.GETAJOB_DB_DIR || path.join(os.homedir(), '.getajob');
const dbPath = path.join(dbDir, 'getajob.db');

if (fs.existsSync(dbPath)) {
  const db = new Database(dbPath);
  try {
    db.exec('ALTER TABLE jobs ADD COLUMN ai_summary TEXT;');
    console.log('Successfully added ai_summary column to jobs table.');
  } catch (e) {
    if (e.message.includes('duplicate column name')) {
      console.log('Column ai_summary already exists.');
    } else {
      console.error('Error adding column:', e.message);
    }
  }
  db.close();
} else {
  console.log('Database not found at', dbPath);
}
