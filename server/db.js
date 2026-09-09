const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'tasks.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks_catalog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    effort TEXT NOT NULL CHECK(effort IN ('bajo','medio','alto')),
    points INTEGER NOT NULL,
    icon TEXT NOT NULL DEFAULT 'default',
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    person TEXT NOT NULL CHECK(person IN ('Tobias','Camila')),
    task_id INTEGER NOT NULL REFERENCES tasks_catalog(id),
    task_name TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT 'default',
    points INTEGER NOT NULL,
    comment TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint TEXT NOT NULL UNIQUE,
    subscription TEXT NOT NULL,
    person TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS monthly_results (
    month TEXT PRIMARY KEY,
    tobias_points INTEGER NOT NULL,
    camila_points INTEGER NOT NULL,
    winner TEXT NOT NULL,
    finalized_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Migración suave: si la tabla entries ya existía sin la columna icon, la agrega.
const entryCols = db.prepare("PRAGMA table_info(entries)").all().map(c => c.name);
if (!entryCols.includes('icon')) {
  db.exec("ALTER TABLE entries ADD COLUMN icon TEXT NOT NULL DEFAULT 'default'");
}

const catalogCount = db.prepare('SELECT COUNT(*) c FROM tasks_catalog').get().c;
if (catalogCount === 0) {
  const insert = db.prepare(
    'INSERT INTO tasks_catalog (name, effort, points, icon) VALUES (?,?,?,?)'
  );
  const insertMany = db.transaction((rows) => {
    for (const r of rows) insert.run(...r);
  });
  insertMany([
    ['Lavar los platos', 'bajo', 2, 'plate'],
    ['Sacar la basura', 'bajo', 1, 'trash'],
    ['Regar las plantas', 'bajo', 1, 'plant'],
    ['Ordenar la casa', 'bajo', 2, 'box'],
    ['Tender / doblar ropa', 'bajo', 2, 'clothes'],
    ['Cambiar las sábanas', 'bajo', 2, 'bed'],
    ['Barrer / pasar el trapo', 'medio', 3, 'broom'],
    ['Pasar la aspiradora', 'medio', 3, 'vacuum'],
    ['Lavar la ropa', 'medio', 3, 'washer'],
    ['Compras del súper', 'medio', 4, 'cart'],
    ['Planchar', 'medio', 4, 'iron'],
    ['Limpiar los vidrios', 'medio', 4, 'window'],
    ['Limpiar la cocina a fondo', 'alto', 5, 'sponge'],
    ['Cocinar (comida principal)', 'alto', 5, 'pot'],
    ['Limpiar el baño', 'alto', 6, 'bath'],
  ]);
}

module.exports = db;
