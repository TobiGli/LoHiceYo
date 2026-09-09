# Puntos de Tareas del Hogar

App web para la competencia mensual de tareas del hogar entre **Tobías** y **Camila**: cada tarea suma puntos según el esfuerzo, se manda una notificación cada vez que alguien carga una, y el **resultado del mes queda definido automáticamente el último día de cada mes**.

Mismo estilo visual (colores, tipografía e íconos) que el diseño original en Claude.

## Stack elegido

Un único servicio Node.js, pensado para desplegarse fácil y gratis en Render:

- **Backend:** Node.js + Express (API REST simple).
- **Base de datos:** SQLite (`better-sqlite3`) — no necesita un servidor de base de datos aparte, un solo archivo. Ver la sección **"Guardar los datos de verdad"** más abajo, es importante.
- **Frontend:** HTML/CSS/JS simple (sin build, sin framework) servido como archivos estáticos por el mismo Express. Menos piezas, deploy más simple.
- **Notificaciones:** Web Push (estándar del navegador, gratis, sin depender de Firebase ni de ningún servicio pago). Funciona como notificación de verdad en el celular si se instala la app ("Agregar a pantalla de inicio").
- **Resultado mensual automático:** un cron interno (`node-cron`) que corre todos los días a las 22:00, más un endpoint (`/api/cron/finalize`) para engancharlo a un cron externo gratuito como respaldo (necesario en el plan gratis de Render, que "duerme" el servicio — ver más abajo).

## Estructura del proyecto

```
puntos-hogar-app/
├── server/
│   ├── index.js          # servidor Express
│   ├── db.js              # SQLite: tablas + catálogo de tareas por defecto
│   ├── push.js             # notificaciones push (web-push)
│   ├── scheduler.js         # cierre de mes + chequeo "último día del mes"
│   └── routes/
│       ├── tasks.js         # catálogo de tareas (agregar/editar/borrar)
│       ├── entries.js        # tareas cargadas (crear/listar/borrar)
│       ├── summary.js         # puntos del mes, resultado final, historial
│       ├── push.js             # suscripción a notificaciones
│       └── cron.js              # endpoint para el cron externo
├── public/                # frontend (HTML/CSS/JS + service worker)
├── scripts/generate-vapid-keys.js
├── render.yaml             # Blueprint de Render
└── .env.example
```

## 1. Correrlo en tu computadora (opcional, para probar antes de subir)

```bash
npm install
cp .env.example .env
npm run generate-vapid-keys   # copiá las 2 líneas que imprime a tu .env
npm start
```

Abrí `http://localhost:3000`.

## 2. Subir a GitHub

```bash
git init
git add .
git commit -m "App de puntos de tareas del hogar"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/TU-REPO.git
git push -u origin main
```

(El repo ya viene con `git init` y el primer commit hecho — si lo preferís, solo agregá el `remote` y hacé `push`.)

## 3. Deploy en Render

**Opción A — Blueprint (recomendada, usa el `render.yaml` incluido):**

1. En [render.com](https://dashboard.render.com), **New +** → **Blueprint**.
2. Elegí tu repositorio de GitHub.
3. Render va a leer `render.yaml` y proponer el servicio `puntos-tareas-hogar`. Confirmá.
4. Te va a pedir los valores de las variables marcadas `sync: false`:
   - `VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY`: corré `npm run generate-vapid-keys` en tu compu y pegá lo que te da.
   - `CRON_SECRET`: inventá cualquier texto largo random (por ejemplo, generalo en https://1password.com/password-generator o con `openssl rand -hex 24`).
5. Deploy. En unos minutos vas a tener una URL tipo `https://puntos-tareas-hogar.onrender.com`.

**Opción B — manual:** New + → Web Service → conectar el repo → Build Command `npm install`, Start Command `npm start` → agregar las variables de entorno de `.env.example` a mano.

### Guardar los datos de verdad (importante)

El plan **gratis** de Render no tiene disco persistente: cada vez que se hace un nuevo deploy (o el servicio se reinicia), el archivo de la base SQLite se borra y arrancás de cero. Sirve para probar la app, pero no para llevar el puntaje en serio mes a mes.

Para que los datos queden guardados para siempre:

1. Cambiá el plan del servicio a **Starter** (u otro plan pago) en Render.
2. En `render.yaml`, descomentá el bloque `disk:` al final del archivo, y cambiá `DB_PATH` a `/var/data/tasks.db`.
3. Volvé a hacer deploy.

Así el archivo de la base vive en un disco que Render no borra.

### Notificaciones cada vez que alguien carga una tarea

Ya vienen andando: en cuanto alguien activa el botón de la campanita en la app (una vez por dispositivo) y otra persona carga una tarea, el resto de los dispositivos suscriptos reciben un push.

Detalles a tener en cuenta:

- **Se necesitan las claves VAPID** configuradas (paso de arriba) — sin eso, el servidor arranca igual pero no manda notificaciones.
- **iPhone:** Safari solo permite notificaciones push si la app está agregada a la pantalla de inicio (compartir → "Agregar a pantalla de inicio") y se abre desde ahí, no desde el navegador. Es una limitación de Apple, no de esta app.
- **Android:** funciona directo desde Chrome, no hace falta instalarla (aunque instalarla con "Agregar a pantalla de inicio" también anda y da una experiencia más de app).
- Cada persona activa las notificaciones en **su propio** celular la primera vez que entra.

### Resultado del mes, el último día del mes

Todos los días a las 22:00 (hora de Argentina, por la variable `TZ`), el servidor se fija si hoy es el último día del mes. Si lo es, calcula el total de puntos de cada uno, guarda quién ganó, y manda una notificación tipo *"🏆 Resultado de septiembre: ganó Camila con 34 puntos"*.

**Ojo con el plan gratis de Render:** el servicio se "duerme" después de 15 minutos sin visitas, y se despierta recién cuando alguien entra a la app. Si a las 22:00 nadie entró, el cron interno no llega a correr ese día. Para que el cierre de mes sea confiable en el plan gratis, hay dos caminos (se puede usar cualquiera de los dos, o ambos):

1. **Más simple: un cron externo gratuito** que visite la app y dispare el cierre. Por ejemplo con [cron-job.org](https://cron-job.org) (gratis):
   - Creá una tarea nueva.
   - URL: `https://TU-APP.onrender.com/api/cron/finalize`
   - Método: `POST`
   - Header: `x-cron-secret: EL-VALOR-QUE-PUSISTE-EN-CRON_SECRET`
   - Frecuencia: una vez por día (por ejemplo, todos los días a las 23:00 hora Argentina).
   - Es seguro que se ejecute todos los días: si no es el último día del mes, o si el mes ya estaba cerrado, no hace nada.
2. O pasar el servicio al plan pago (no se duerme nunca), y con eso alcanza el cron interno.

### Probar el cierre de mes sin esperar a fin de mes

```bash
curl -X POST https://TU-APP.onrender.com/api/cron/finalize?force=1&month=2026-09 \
  -H "x-cron-secret: EL-VALOR-DE-CRON_SECRET"
```

Esto recalcula y sobreescribe el resultado de ese mes (útil para probar la notificación), sin esperar al día 30.

## API

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/tasks` | catálogo de tareas y sus puntos |
| POST | `/api/tasks` | agregar una tarea nueva al catálogo |
| GET | `/api/entries?month=YYYY-MM` | tareas cargadas en ese mes |
| POST | `/api/entries` | cargar una tarea hecha (dispara la notificación) |
| DELETE | `/api/entries/:id` | borrar una carga |
| GET | `/api/summary?month=YYYY-MM` | puntos del mes, quién va ganando, si ya está cerrado |
| GET | `/api/summary/results` | historial de meses cerrados y quién ganó cada uno |
| POST | `/api/push/subscribe` | guardar la suscripción push de un dispositivo |
| POST | `/api/cron/finalize` | fuerza el chequeo/cierre de mes (requiere `x-cron-secret`) |

## Ideas para más adelante (no incluidas)

- Login por PIN para que cada uno solo pueda cargar tareas a su propio nombre.
- Editar el catálogo de tareas desde la interfaz (hoy se puede vía API, `POST/PATCH /api/tasks`).
- Racha de días seguidos, medallas, etc.
