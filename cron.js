const express = require('express');
const { runDailyCheck, finalizeMonth } = require('../scheduler');

const router = express.Router();

/**
 * Pensado para ser llamado una vez por día por un cron externo gratuito
 * (cron-job.org, Render Cron Jobs, etc. - ver README) como respaldo del
 * cron interno, por si el servicio estuvo dormido a las 22:00.
 *
 * Es seguro llamarlo varias veces: si hoy no es el último día del mes, o si
 * el mes ya fue cerrado, no hace nada (salvo que se pida ?force=1).
 *
 * Requiere el header:  x-cron-secret: <CRON_SECRET>
 */
router.post('/finalize', async (req, res) => {
  const secret = req.header('x-cron-secret');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  try {
    if (req.query.force === '1' && req.query.month) {
      const { result, created } = await finalizeMonth(req.query.month, { force: true });
      return res.json({ ran: true, forced: true, created, result });
    }
    const outcome = await runDailyCheck();
    res.json(outcome);
  } catch (err) {
    console.error('[cron] error:', err);
    res.status(500).json({ error: 'Error cerrando el mes.' });
  }
});

module.exports = router;
