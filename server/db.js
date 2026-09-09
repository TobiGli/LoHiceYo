const path = require('path');
const fs = require('fs');
const { createClient } = require('@libsql/client');

// Si hay TURSO_DATABASE_URL configurada, la app guarda los datos en Turso
// (SQLite en la nube, gratis y persistente - no se borra con cada deploy).
// Si no hay ninguna configurada, usa un archivo SQLite local (para desarrollo
// en tu computadora). Ver README para cómo crear la base en Turso.
const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

let clientConfig;
if (TURSO_URL) {
  clientConfig = { url: TURSO_URL, authToken: TURSO_TOKEN };
} else {
  const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'tasks.db');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  clientConfig = { url: `file:${dbPath}` };
  console.log(`[db] Sin TURSO_DATABASE_URL: usando archivo local ${dbPath} (no persiste en Render).`);
}

const db = createClient(clientConfig);

const DEFAULT_TASKS = [
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
];

let ready = null;

function init() {
  if (!ready) ready = doInit();
  return ready;
}

async function doInit() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS tasks_catalog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      effort TEXT NOT NULL CHECK(effort IN ('bajo','medio','alto')),
      points INTEGER NOT NULL,
      icon TEXT NOT NULL DEFAULT 'default',
      active INTEGER NOT NULL DEFAULT 1
    )
  `);

  await db.execute(`
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
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint TEXT NOT NULL UNIQUE,
      subscription TEXT NOT NULL,
      person TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS monthly_results (
      month TEXT PRIMARY KEY,
      tobias_points INTEGER NOT NULL,
      camila_points INTEGER NOT NULL,
      winner TEXT NOT NULL,
      finalized_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const { rows } = await db.execute('SELECT COUNT(*) AS c FROM tasks_catalog');
  if (Number(rows[0].c) === 0) {
    for (const [name, effort, points, icon] of DEFAULT_TASKS) {
      await db.execute({
        sql: 'INSERT INTO tasks_catalog (name, effort, points, icon) VALUES (?,?,?,?)',
        args: [name, effort, points, icon],
      });
    }
    console.log('[db] Catálogo de tareas por defecto creado.');
  }
}

module.exports = { db, init };
