require('dotenv').config();

const path = require('path');
const express = require('express');

const { init } = require('./db');

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

init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`LoHiceYo escuchando en el puerto ${PORT}`);
      scheduler.start();
    });
  })
  .catch((err) => {
    console.error('No se pudo inicializar la base de datos:', err);
    process.exit(1);
  });
