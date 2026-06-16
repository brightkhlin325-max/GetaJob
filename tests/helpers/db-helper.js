/**
 * DB Helper - E2E Testing SQLite Database Controller
 * File: /tests/helpers/db-helper.js
 */
const path = require('path');
const os = require('os');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_DIR = path.join(os.homedir(), '.getajob');
const TEST_DB_PATH = path.join(DB_DIR, 'getajob_test.db');

class DbHelper {
  constructor() {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    this.db = new Database(TEST_DB_PATH);
    this.db.pragma('foreign_keys = ON');
    this.initSchema();
  }

  /**
   * Initializes the DB structure ensuring we test against the exact production schema.
   */
  initSchema() {
    this.db.exec(`
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
        title TEXT,
        company TEXT,
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
        job_id INTEGER,
        resume_id INTEGER,
        match_score INTEGER,
        match_analysis TEXT,
        cover_letter TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE CASCADE,
        FOREIGN KEY(resume_id) REFERENCES resumes(id) ON DELETE CASCADE
      );
    `);
  }

  /**
   * Cleans all data tables to reset states between individual test specs.
   */
  clearDatabase() {
    this.db.exec(`
      DELETE FROM job_analyses;
      DELETE FROM jobs;
      DELETE FROM resumes;
      DELETE FROM settings;
    `);
  }

  /**
   * Seeds key-value settings.
   */
  seedSettings(settings = {}) {
    const stmt = this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    const insertMany = this.db.transaction((data) => {
      for (const [key, value] of Object.entries(data)) {
        stmt.run(key, typeof value === 'string' ? value : JSON.stringify(value));
      }
    });
    insertMany(settings);
  }

  /**
   * Seeds resume entries.
   */
  seedResumes(resumes = []) {
    const stmt = this.db.prepare(`
      INSERT INTO resumes (id, file_name, raw_text, parsed_json, is_active)
      VALUES (?, ?, ?, ?, ?)
    `);
    const insertMany = this.db.transaction((list) => {
      for (const r of list) {
        stmt.run(
          r.id || null,
          r.file_name,
          r.raw_text,
          typeof r.parsed_json === 'string' ? r.parsed_json : JSON.stringify(r.parsed_json),
          r.is_active || 0
        );
      }
    });
    insertMany(resumes);
  }

  /**
   * Seeds clipped or manual jobs.
   */
  seedJobs(jobs = []) {
    const stmt = this.db.prepare(`
      INSERT INTO jobs (id, title, company, location, salary, url, description, source, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertMany = this.db.transaction((list) => {
      for (const j of list) {
        stmt.run(
          j.id || null,
          j.title,
          j.company,
          j.location,
          j.salary,
          j.url,
          j.description,
          j.source,
          j.status || 'Interested'
        );
      }
    });
    insertMany(jobs);
  }

  /**
   * Seeds precalculated fit analyses and cover letters.
   */
  seedJobAnalyses(analyses = []) {
    const stmt = this.db.prepare(`
      INSERT INTO job_analyses (id, job_id, resume_id, match_score, match_analysis, cover_letter)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const insertMany = this.db.transaction((list) => {
      for (const a of list) {
        stmt.run(
          a.id || null,
          a.job_id,
          a.resume_id,
          a.match_score,
          typeof a.match_analysis === 'string' ? a.match_analysis : JSON.stringify(a.match_analysis),
          a.cover_letter
        );
      }
    });
    insertMany(analyses);
  }

  close() {
    this.db.close();
  }
}

module.exports = DbHelper;
