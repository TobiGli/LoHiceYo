const express = require('express');
const db = require('../db');
const push = require('../push');

const router = express.Router();

// La clave pública VAPID que necesita el navegador para suscribirse.
router.get('/vapid-public-key', (req, res) => {
  if (!push.enabled) return res.status(503).json({ error: 'Push no configurado en el servidor.' });
  res.json({ publicKey: push.publicKey });
});

// Guarda (o actualiza) la suscripción push de este dispositivo.
router.post('/subscribe', (req, res) => {
  const { subscription, person } = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Falta la suscripción.' });
  }
  db.prepare(
    `INSERT INTO push_subscriptions (endpoint, subscription, person)
     VALUES (?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET subscription = excluded.subscription, person = excluded.person`
  ).run(subscription.endpoint, JSON.stringify(subscription), person || null);
  res.status(201).json({ ok: true });
});

// Da de baja las notificaciones en este dispositivo.
router.post('/unsubscribe', (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) return res.status(400).json({ error: 'Falta el endpoint.' });
  db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
  res.json({ ok: true });
});

module.exports = router;
