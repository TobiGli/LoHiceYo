// Genera un par de claves VAPID para las notificaciones push.
// Uso: npm run generate-vapid-keys
const webpush = require('web-push');

const keys = webpush.generateVAPIDKeys();

console.log('\nAgregá estas dos variables a tu .env (o a las Environment Variables de Render):\n');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log('\nNo compartas la clave privada.\n');
