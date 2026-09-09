const express = require('express');
const db = require('../db');

const router = express.Router();

// Lista el catálogo de tareas (activas por defecto).
router.get('/', (req, res) => {
  const includeInactive = req.query.all === '1';
  const rows = includeInactive
    ? db.prepare('SELECT * FROM tasks_catalog ORDER BY points ASC, name ASC').all()
    : db.prepare('SELECT * FROM tasks_catalog WHERE active = 1 ORDER BY points ASC, name ASC').all();
  res.json(rows);
});

// Agrega una tarea nueva al catálogo.
router.post('/', (req, res) => {
  const { name, effort, points, icon } = req.body;
  if (!name || !effort || !Number.isFinite(Number(points))) {
    return res.status(400).json({ error: 'Faltan datos: name, effort y points son obligatorios.' });
  }
  if (!['bajo', 'medio', 'alto'].includes(effort)) {
    return res.status(400).json({ error: 'effort debe ser "bajo", "medio" o "alto".' });
  }
  try {
    const info = db
      .prepare('INSERT INTO tasks_catalog (name, effort, points, icon) VALUES (?,?,?,?)')
      .run(name.trim(), effort, Math.round(Number(points)), icon || 'default');
    const row = db.prepare('SELECT * FROM tasks_catalog WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(row);
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Ya existe una tarea con ese nombre.' });
    }
    res.status(500).json({ error: 'No se pudo guardar la tarea.' });
  }
});

// Edita una tarea existente (nombre, esfuerzo, puntos o ícono).
router.patch('/:id', (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM tasks_catalog WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Tarea no encontrada.' });

  const name = req.body.name ?? existing.name;
  const effort = req.body.effort ?? existing.effort;
  const points = req.body.points != null ? Math.round(Number(req.body.points)) : existing.points;
  const icon = req.body.icon ?? existing.icon;
  const active = req.body.active != null ? (req.body.active ? 1 : 0) : existing.active;

  db.prepare('UPDATE tasks_catalog SET name=?, effort=?, points=?, icon=?, active=? WHERE id=?').run(
    name,
    effort,
    points,
    icon,
    active,
    id
  );
  res.json(db.prepare('SELECT * FROM tasks_catalog WHERE id = ?').get(id));
});

// "Borra" una tarea del catálogo (soft delete: queda inactiva, no rompe el historial).
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM tasks_catalog WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Tarea no encontrada.' });
  db.prepare('UPDATE tasks_catalog SET active = 0 WHERE id = ?').run(id);
  res.json({ ok: true });
});

module.exports = router;
