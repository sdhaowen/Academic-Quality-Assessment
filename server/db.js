import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const dataDir = path.join(projectRoot, "data");
const dbPath = path.join(dataDir, "assessment.db");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      student_no TEXT NOT NULL UNIQUE,
      class_name TEXT NOT NULL,
      school TEXT NOT NULL,
      stage TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS assessments (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      stage TEXT NOT NULL,
      scores_json TEXT NOT NULL,
      assessed_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
      FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_students_stage ON students(stage);
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_assessments_stage ON assessments(stage);
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_assessments_student_time
    ON assessments(student_id, assessed_at);
  `);
}

export { db, dbPath };

