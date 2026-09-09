const cron = require('node-cron');
const { db } = require('./db');
const { sendNotificationToAll } = require('./push');

function pad(n) {
  return String(n).padStart(2, '0');
}

function monthKeyOf(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function isLastDayOfMonth(date) {
  const tomorrow = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return tomorrow.getMonth() !== date.getMonth();
}

async function computeTotals(monthKey) {
  const { rows } = await db.execute({
    sql: `SELECT person, COALESCE(SUM(points), 0) AS pts FROM entries WHERE substr(date, 1, 7) = ? GROUP BY person`,
    args: [monthKey],
  });
  const totals = { Tobias: 0, Camila: 0 };
  for (const r of rows) totals[r.person] = Number(r.pts);
  return totals;
}

async function getMonthlyResult(monthKey) {
  const { rows } = await db.execute({
    sql: 'SELECT * FROM monthly_results WHERE month = ?',
    args: [monthKey],
  });
  return rows[0] || null;
}

/**
 * Calcula y guarda el resultado final de un mes, y avisa por push.
 * Es idempotente: si ya existe un resultado guardado para ese mes no vuelve a
 * calcularlo (salvo que se pase { force: true }, útil para pruebas).
 */
async function finalizeMonth(monthKey, { force = false, notify = true } = {}) {
  const existing = await getMonthlyResult(monthKey);
  if (existing && !force) {
    return { result: existing, created: false };
  }

  const totals = await computeTotals(monthKey);
  let winner = 'Empate';
  if (totals.Tobias > totals.Camila) winner = 'Tobias';
  else if (totals.Camila > totals.Tobias) winner = 'Camila';

  await db.execute({
    sql: `INSERT INTO monthly_results (month, tobias_points, camila_points, winner, finalized_at)
          VALUES (?, ?, ?, ?, datetime('now'))
          ON CONFLICT(month) DO UPDATE SET
            tobias_points = excluded.tobias_points,
            camila_points = excluded.camila_points,
            winner = excluded.winner,
            finalized_at = excluded.finalized_at`,
    args: [monthKey, totals.Tobias, totals.Camila, winner],
  });

  const result = await getMonthlyResult(monthKey);

  if (notify) {
    const label = winner === 'Empate' ? 'Empate 🤝' : `Ganó ${winner === 'Tobias' ? 'Tobías' : 'Camila'} 🏆`;
    await sendNotificationToAll({
      title: `Resultado de ${monthKey}`,
      body: `${label} — Tobías ${totals.Tobias} pts, Camila ${totals.Camila} pts`,
      tag: `monthly-result-${monthKey}`,
      url: '/#resultados',
    }).catch((e) => console.error('[scheduler] error mandando push de resultado mensual:', e));
  }

  return { result, created: true };
}

/**
 * Corre el chequeo diario "¿hoy es el último día del mes?" y, si es así,
 * cierra el mes. Se puede llamar a mano (por ejemplo desde /api/cron/finalize)
 * o queda programada con node-cron mientras el proceso esté vivo.
 */
async function runDailyCheck() {
  const today = new Date();
  if (!isLastDayOfMonth(today)) {
    return { ran: false, reason: 'hoy no es el último día del mes' };
  }
  const monthKey = monthKeyOf(today);
  const { result, created } = await finalizeMonth(monthKey);
  return { ran: true, monthKey, created, result };
}

function start() {
  // Corre todos los días a las 22:00 (hora del servidor / TZ configurada).
  // Si ese día resulta ser el último del mes, cierra el mes y notifica.
  // OJO: en el plan free de Render el servicio se "duerme" con inactividad,
  // así que este cron interno puede no dispararse ese día. Como respaldo,
  // /api/cron/finalize puede llamarse desde un cron externo gratuito
  // (ver README) y hace exactamente lo mismo de forma segura de repetir.
  cron.schedule('0 22 * * *', () => {
    runDailyCheck().catch((e) => console.error('[scheduler] error en el chequeo diario:', e));
  });
  console.log('[scheduler] chequeo diario de fin de mes programado (22:00).');
}

module.exports = {
  start,
  finalizeMonth,
  runDailyCheck,
  computeTotals,
  isLastDayOfMonth,
  monthKeyOf,
};
