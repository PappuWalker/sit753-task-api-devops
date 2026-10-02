const express = require('express');
const client = require('prom-client');
const { isValidTitle } = require('./validation');

const app = express();
app.use(express.json());

// --- Prometheus Metrics Setup ---
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests processed',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

// Middleware to track requests
app.use((req, res, next) => {
  res.on('finish', () => {
    httpRequestsTotal.inc({ method: req.method, route: req.path, status_code: res.statusCode });
  });
  next();
});

// --- Simple In-Memory Database ---
let tasks = [
  { id: 1, title: 'Configure Jenkins Pipeline', completed: true },
  { id: 2, title: 'Deploy to Production', completed: false }
];

// --- API Endpoints ---
app.get('/health', (req, res) => res.status(200).json({ status: 'UP' }));

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.get('/api/tasks', (req, res) => res.status(200).json(tasks));

app.post('/api/tasks', (req, res) => {
  if (!isValidTitle(req.body.title)) return res.status(400).json({ error: 'Title is required' });
  const newTask = { id: tasks.length + 1, title: req.body.title, completed: false };
  tasks.push(newTask);
  res.status(201).json(newTask);
});

const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => console.log(`Task API running on port ${PORT}`));
}

module.exports = app;