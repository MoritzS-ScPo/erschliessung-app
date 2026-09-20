import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Siehe server/index.js: in einer gepackten Electron-App zeigt diese Variable
// auf einen beschreibbaren, nutzerspezifischen Ordner statt in den (schreib-
// geschützten) Installationsordner.
const APP_DATA_DIR = process.env.ERSCHLIESSUNG_DATA_DIR || path.join(__dirname, "..");
const DATA_DIR = path.join(APP_DATA_DIR, "data");
fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(path.join(DATA_DIR, "archiv.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS erschliessungen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    erschliessungsdatum TEXT NOT NULL,
    autor_vorname TEXT,
    autor_nachname TEXT,
    dokumentart TEXT,
    gattung TEXT,
    signatur TEXT,
    docx_path TEXT,
    volltext TEXT,
    form_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

export function insertErschliessung(record) {
  const stmt = db.prepare(`
    INSERT INTO erschliessungen
      (erschliessungsdatum, autor_vorname, autor_nachname, dokumentart, gattung, signatur, docx_path, volltext, form_json)
    VALUES (@erschliessungsdatum, @autor_vorname, @autor_nachname, @dokumentart, @gattung, @signatur, @docx_path, @volltext, @form_json)
  `);
  const info = stmt.run(record);
  return info.lastInsertRowid;
}

export function listErschliessungen() {
  return db
    .prepare(
      `SELECT id, erschliessungsdatum, autor_vorname, autor_nachname, dokumentart, gattung, signatur, docx_path, created_at
       FROM erschliessungen ORDER BY created_at DESC`
    )
    .all();
}

export function getErschliessung(id) {
  return db.prepare(`SELECT * FROM erschliessungen WHERE id = ?`).get(id);
}

export function deleteErschliessung(id) {
  return db.prepare(`DELETE FROM erschliessungen WHERE id = ?`).run(id);
}
