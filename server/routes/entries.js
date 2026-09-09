const express = require('express');
const db = require('../db');
const { sendNotificationToAll } = require('../push');

const router = express.Router();

const PERSON_LABEL = { Tobias: 'Tobías', Camila: 'Camila' };

// Lista las tareas cargadas en un mes (?month=YYYY-MM). Sin ?month, trae todo.
router.get('/', (req, res) => {
  const { month } = req.query;
  const rows = month
    ? db
        .prepare('SELECT * FROM entries WHERE substr(date, 1, 7) = ? ORDER BY date DESC, id DESC')
        .all(month)
    : db.prepare('SELECT * FROM entries ORDER BY date DESC, id DESC').all();
  res.json(rows);
});

// Carga una tarea hecha: dispara una notificación push al resto.
router.post('/', async (req, res) => {
  const { date, person, task_id, comment } = req.body;

  if (!date || !person || !task_id) {
    return res.status(400).json({ error: 'Faltan datos: date, person y task_id son obligatorios.' });
  }
  if (!['Tobias', 'Camila'].includes(person)) {
    return res.status(400).json({ error: 'person debe ser "Tobias" o "Camila".' });
  }

  const task = db.prepare('SELECT * FROM tasks_catalog WHERE id = ?').get(task_id);
  if (!task) return res.status(404).json({ error: 'Esa tarea no existe en el catálogo.' });

  const info = db
    .prepare(
      `INSERT INTO entries (date, person, task_id, task_name, icon, points, comment)
       VALUES (?,?,?,?,?,?,?)`
    )
    .run(date, person, task.id, task.name, task.icon, task.points, comment ? String(comment).slice(0, 280) : null);

  const entry = db.prepare('SELECT * FROM entries WHERE id = ?').get(info.lastInsertRowid);

  res.status(201).json(entry);

  // La notificación no debe frenar la respuesta al que cargó la tarea.
  sendNotificationToAll({
    title: `${PERSON_LABEL[person]} sumó puntos 🎉`,
    body: `${task.name} · +${task.points} pts`,
    tag: 'new-entry',
    url: '/',
  }).catch((e) => console.error('[entries] error mandando push:', e));
});

// Borra una tarea cargada por error.
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM entries WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'No se encontró esa carga.' });
  db.prepare('DELETE FROM entries WHERE id = ?').run(id);
  res.json({ ok: true });
});

module.exports = router;
