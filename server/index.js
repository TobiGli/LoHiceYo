require('dotenv').config();

const path = require('path');
const express = require('express');

require('./db'); // asegura que la base y el catálogo existan antes de levantar rutas

const tasksRouter = require('./routes/tasks');
const entriesRouter = require('./routes/entries');
const summaryRouter = require('./routes/summary');
const pushRouter = require('./routes/push');
const cronRouter = require('./routes/cron');
const scheduler = require('./scheduler');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/api/tasks', tasksRouter);
app.use('/api/entries', entriesRouter);
app.use('/api/summary', summaryRouter);
app.use('/api/push', pushRouter);
app.use('/api/cron', cronRouter);

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use(express.static(path.join(__dirname, '..', 'public')));

app.listen(PORT, () => {
  console.log(`Puntos de Tareas del Hogar escuchando en el puerto ${PORT}`);
  scheduler.start();
});
