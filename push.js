const webpush = require('web-push');
const { db } = require('./db');

const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:example@example.com';

let enabled = false;
if (PUBLIC_KEY && PRIVATE_KEY) {
  webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
  enabled = true;
} else {
  console.warn(
    '[push] Faltan VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY: las notificaciones push están desactivadas. ' +
    'Generalas con "npm run generate-vapid-keys" y agregalas como variables de entorno.'
  );
}

/**
 * Manda una notificación push a todos los dispositivos suscriptos.
 * Si un dispositivo ya no existe (410/404), borra su suscripción.
 */
async function sendNotificationToAll(payload) {
  if (!enabled) return { sent: 0, total: 0, skipped: true };

  const { rows } = await db.execute('SELECT * FROM push_subscriptions');
  const data = JSON.stringify(payload);
  let sent = 0;

  for (const row of rows) {
    try {
      const subscription = JSON.parse(row.subscription);
      await webpush.sendNotification(subscription, data);
      sent++;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await db.execute({ sql: 'DELETE FROM push_subscriptions WHERE id = ?', args: [row.id] });
      } else {
        console.error('[push] error enviando notificación:', err.statusCode, err.message);
      }
    }
  }

  return { sent, total: rows.length };
}

module.exports = { sendNotificationToAll, publicKey: PUBLIC_KEY, enabled };
