const express = require('express');
const { db } = require('../db');
const { computeTotals, monthKeyOf } = require('../scheduler');

const router = express.Router();

function currentMonthKey() {
  return monthKeyOf(new Date());
}

// Estado del mes: puntos en vivo de cada uno, si ya está definido el resultado,
// y cuándo se define (siempre el último día del mes).
router.get('/', async (req, res) => {
  const month = req.query.month || currentMonthKey();
  const totals = await computeTotals(month);
  const { rows } = await db.execute({ sql: 'SELECT * FROM monthly_results WHERE month = ?', args: [month] });
  const finalResult = rows[0] || null;

  let leader = 'Empate';
  if (totals.Tobias > totals.Camila) leader = 'Tobias';
  else if (totals.Camila > totals.Tobias) leader = 'Camila';

  const [y, m] = month.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();

  res.json({
    month,
    totals,
    leader, // quién va ganando ahora mismo (parcial, no es el resultado final)
    isFinal: !!finalResult,
    finalResult,
    definesOn: `${String(lastDay).padStart(2, '0')}-${String(m).padStart(2, '0')}-${y}`,
    isCurrentMonth: month === currentMonthKey(),
  });
});

// Historial de meses ya cerrados, más reciente primero.
router.get('/results', async (req, res) => {
  const { rows } = await db.execute('SELECT * FROM monthly_results ORDER BY month DESC');
  res.json(rows);
});

module.exports = router;
