const express = require('express');
const { db } = require('../db');
const { sendNotificationToAll } = require('../push');

const router = express.Router();

const PERSON_LABEL = { Tobias: 'Tobías', Camila: 'Camila' };

// Lista las tareas cargadas en un mes (?month=YYYY-MM). Sin ?month, trae todo.
router.get('/', async (req, res) => {
  const { month } = req.query;
  const { rows } = month
    ? await db.execute({
        sql: 'SELECT * FROM entries WHERE substr(date, 1, 7) = ? ORDER BY date DESC, id DESC',
        args: [month],
      })
    : await db.execute('SELECT * FROM entries ORDER BY date DESC, id DESC');
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

  const { rows: taskRows } = await db.execute({ sql: 'SELECT * FROM tasks_catalog WHERE id = ?', args: [task_id] });
  const task = taskRows[0];
  if (!task) return res.status(404).json({ error: 'Esa tarea no existe en el catálogo.' });

  const ins = await db.execute({
    sql: `INSERT INTO entries (date, person, task_id, task_name, icon, points, comment)
          VALUES (?,?,?,?,?,?,?)`,
    args: [date, person, task.id, task.name, task.icon, task.points, comment ? String(comment).slice(0, 280) : null],
  });

  const { rows } = await db.execute({
    sql: 'SELECT * FROM entries WHERE id = ?',
    args: [Number(ins.lastInsertRowid)],
  });
  const entry = rows[0];

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
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const { rows } = await db.execute({ sql: 'SELECT * FROM entries WHERE id = ?', args: [id] });
  if (!rows[0]) return res.status(404).json({ error: 'No se encontró esa carga.' });
  await db.execute({ sql: 'DELETE FROM entries WHERE id = ?', args: [id] });
  res.json({ ok: true });
});

module.exports = router;
