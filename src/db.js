const Database = require("better-sqlite3");
const fs = require("node:fs");
const path = require("node:path");

const dataDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "bot.db");
const db = new Database(dbPath);

// Un po' di robustezza in più
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS generations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  prompt TEXT NOT NULL,
  image_path TEXT NOT NULL,
  source_type TEXT NOT NULL,
  parent_generation_id INTEGER,
  FOREIGN KEY (parent_generation_id) REFERENCES generations(id) ON DELETE SET NULL
);
`);

// Inserisce una nuova generazione
function insertGeneration({ userId, prompt, imagePath, sourceType, parentGenerationId }) {
  const createdAt = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO generations (user_id, created_at, prompt, image_path, source_type, parent_generation_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(userId, createdAt, prompt, imagePath, sourceType, parentGenerationId || null);

  return {
    id: info.lastInsertRowid,
    user_id: userId,
    created_at: createdAt,
    prompt,
    image_path: imagePath,
    source_type: sourceType,
    parent_generation_id: parentGenerationId || null,
  };
}

// Recupera le ultime N generazioni per utente (ord. decrescente)
function getLastGenerationsForUser(userId, limit) {
  const stmt = db.prepare(`
    SELECT * FROM generations
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `);
  return stmt.all(userId, limit);
}

// Mantiene solo le ultime "max" generazioni per utente
function pruneGenerationsForUser(userId, max) {
  const stmt = db.prepare(`
    DELETE FROM generations
    WHERE user_id = ?
      AND id NOT IN (
        SELECT id FROM generations
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      )
  `);
  stmt.run(userId, userId, max);
}

// Singola generazione per ID
function getGenerationById(id) {
  const stmt = db.prepare(`SELECT * FROM generations WHERE id = ?`);
  return stmt.get(id);
}

// Conteggio generazioni utente in un intervallo di tempo
function countUserGenerationsInRange(userId, startIso, endIso) {
  const stmt = db.prepare(`
    SELECT COUNT(*) AS count
    FROM generations
    WHERE user_id = ?
      AND created_at >= ?
      AND created_at < ?
  `);
  const row = stmt.get(userId, startIso, endIso);
  return row ? row.count : 0;
}

// Conteggio generazioni globali in un intervallo di tempo
function countGenerationsInRange(startIso, endIso) {
  const stmt = db.prepare(`
    SELECT COUNT(*) AS count
    FROM generations
    WHERE created_at >= ?
      AND created_at < ?
  `);
  const row = stmt.get(startIso, endIso);
  return row ? row.count : 0;
}

module.exports = {
  insertGeneration,
  getLastGenerationsForUser,
  pruneGenerationsForUser,
  getGenerationById,
  countUserGenerationsInRange,
  countGenerationsInRange,
};
