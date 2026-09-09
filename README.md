# LoHiceYo

**LoHiceYo** es una app web para llevar el puntaje de las tareas del hogar entre dos personas — en este caso, **Tobías** y **Camila**. Cada tarea del catálogo tiene un puntaje según su esfuerzo (bajo, medio o alto); cada vez que alguien hace algo lo carga en la app, suma sus puntos, y al final del mes se sabe quién ganó. El mismo estilo visual (colores, tipografía e íconos dibujados a mano) del diseño original se mantiene en toda la app.

Lo que hace, en criollo:

- **Catálogo de tareas con puntos**, editable desde la propia interfaz: se pueden agregar tareas nuevas, cambiarles el nombre/esfuerzo/puntos/ícono, o sacarlas del catálogo (sin borrar el historial de cargas viejas).
- **Carga rápida de una tarea hecha**: quién la hizo, qué tarea, qué día, y un comentario opcional.
- **Resumen en vivo del mes**: puntos de cada uno, quién va ganando, y una barra de progreso.
- **Notificaciones push al celular** cada vez que alguien carga una tarea, para que el otro se entere al toque.
- **Resultado del mes automático**: el último día de cada mes queda definido y guardado quién ganó, con notificación tipo "🏆 Resultado de septiembre: ganó Camila con 34 puntos". El historial de meses cerrados queda a mano en la app.

## Stack

Pensada para ser un único servicio, fácil y gratis de correr y de desplegar:

- **Backend:** Node.js + Express, una API REST chica.
- **Base de datos:** SQLite alojada gratis en [Turso](https://turso.tech) (vía `@libsql/client`). Es el mismo SQLite de siempre pero corriendo en la nube en vez del disco del servidor — así los datos no se pierden aunque el hosting sea gratis y el servicio se reinicie. Este repo ya viene con una base de Turso creada y sus credenciales cargadas en `.env`.
- **Frontend:** HTML/CSS/JS simple, sin build ni framework, servido como archivos estáticos por el mismo Express.
- **Notificaciones:** Web Push, el estándar del navegador — gratis, sin Firebase ni servicios pagos de por medio. Para que funcionen como notificación de verdad en el celular (sobre todo en iPhone) conviene instalar la app a la pantalla de inicio.
- **Cierre de mes:** un cron interno (`node-cron`) que corre todos los días y se fija si es el último día del mes, más un endpoint (`/api/cron/finalize`) pensado para engancharlo a un cron externo gratuito como respaldo — útil porque el plan gratis de Render "duerme" el servicio y puede no estar despierto justo a esa hora.

## Estructura del proyecto

```
lohiceyo/
├── server/
│   ├── index.js          # servidor Express
│   ├── db.js              # conexión a Turso (o SQLite local) + catálogo por defecto
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

## Cómo correrla

El repo ya viene con todo lo necesario configurado en `.env` — la base de Turso, las claves VAPID de notificaciones y el secreto del cron. Con eso, correrla local es instalar dependencias y arrancar el servidor:

```bash
npm install
npm start
```

Y abrir `http://localhost:3000`. No hace falta crear tablas ni tocar la base a mano: la app las crea solas la primera vez que arranca.

Para subirla a un repositorio de GitHub, el proyecto ya tiene `git init` y un primer commit hechos — alcanza con agregar el `remote` de tu repositorio y hacer `push`. El `.env` con las credenciales reales está en `.gitignore`, así que nunca se sube a GitHub; solo queda en tu computadora.

Para desplegarla en producción, este repo incluye un `render.yaml` (Blueprint de [Render](https://render.com)) listo para usar: Render lee ese archivo, propone el servicio `lohiceyo`, y solo pide pegar a mano los valores marcados como secretos (`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, las claves VAPID y `CRON_SECRET`) — todos están en el `.env` de este repo, listos para copiar y pegar, porque Render no lee archivos `.env` directamente.

Si en algún momento hay que rotar el token de Turso (por ejemplo, si se filtró), se genera uno nuevo desde [turso.tech](https://turso.tech) → la base → **Auth Token**, y se actualiza tanto en el `.env` local como en las variables de entorno de Render.

### Por qué los datos no se pierden

Antes de mudar la base a Turso, esta app guardaba todo en el disco del propio servicio de Render, que en el plan gratis se borra en cada deploy o reinicio — el problema típico de correr algo gratis. Ahora la base vive aparte, en Turso, un SQLite alojado en la nube con un plan gratis pensado justo para este tipo de uso liviano (dos personas cargando algunas tareas por día), sin fecha de borrado. Render puede reiniciarse o volver a desplegar las veces que quiera: la base sigue intacta en Turso.

### Notificaciones

En cuanto alguien activa la campanita en la app (una vez por dispositivo, pidiendo permiso de notificaciones) y otra persona carga una tarea, el resto de los dispositivos suscriptos reciben un push al instante. Cada persona activa las notificaciones en su propio celular la primera vez que entra, y sin las claves VAPID configuradas la app funciona igual pero no manda notificaciones.

En iPhone, Safari solo permite notificaciones push si la app está agregada a la pantalla de inicio (compartir → "Agregar a pantalla de inicio") y se abre desde ahí — es una limitación de Apple, no de la app. En Android funciona directo desde Chrome sin necesidad de instalarla, aunque instalarla también da una experiencia más de app.

### Cierre de mes

Todos los días a una hora fija (configurable por la variable `TZ`), el servidor revisa si hoy es el último día del mes; si lo es, calcula el total de puntos de cada uno, guarda quién ganó y manda la notificación con el resultado. Como el plan gratis de Render duerme el servicio después de un rato sin visitas, conviene además apuntar un cron externo gratuito (por ejemplo [cron-job.org](https://cron-job.org)) a `POST /api/cron/finalize` con el header `x-cron-secret` una vez por día, como respaldo — correrlo todos los días es seguro, porque si no es fin de mes o el mes ya estaba cerrado, no hace nada.

Para probar el cierre sin esperar a fin de mes, se puede forzar puntualmente:

```bash
curl -X POST https://TU-APP.onrender.com/api/cron/finalize?force=1&month=2026-09 \
  -H "x-cron-secret: EL-VALOR-DE-CRON_SECRET"
```

## API

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/tasks` | catálogo de tareas y sus puntos |
| POST | `/api/tasks` | agregar una tarea nueva al catálogo |
| PATCH | `/api/tasks/:id` | editar nombre, esfuerzo, puntos o ícono de una tarea |
| DELETE | `/api/tasks/:id` | borrar (soft-delete) una tarea del catálogo |
| GET | `/api/entries?month=YYYY-MM` | tareas cargadas en ese mes |
| POST | `/api/entries` | cargar una tarea hecha (dispara la notificación) |
| DELETE | `/api/entries/:id` | borrar una carga |
| GET | `/api/summary?month=YYYY-MM` | puntos del mes, quién va ganando, si ya está cerrado |
| GET | `/api/summary/results` | historial de meses cerrados y quién ganó cada uno |
| POST | `/api/push/subscribe` | guardar la suscripción push de un dispositivo |
| POST | `/api/cron/finalize` | fuerza el chequeo/cierre de mes (requiere `x-cron-secret`) |

## Ideas para más adelante

- Login por PIN para que cada uno solo pueda cargar tareas a su propio nombre.
- Racha de días seguidos, medallas, etc.
