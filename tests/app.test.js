const request = require('supertest');
const app = require('../src/app');

describe('Task Manager API Tests', () => {
  it('GET /health returns status UP', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toEqual(200);
    expect(res.body.status).toEqual('UP');
  });

  it('GET /metrics exposes Prometheus telemetry', async () => {
    const res = await request(app).get('/metrics');
    expect(res.statusCode).toEqual(200);
    expect(res.text).toContain('http_requests_total');
  });

  it('GET /api/tasks lists all tasks', async () => {
    const res = await request(app).get('/api/tasks');
    expect(res.statusCode).toEqual(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });

  it('POST /api/tasks creates a new task', async () => {
    const res = await request(app).post('/api/tasks').send({ title: 'New Test Task' });
    expect(res.statusCode).toEqual(201);
    expect(res.body.title).toEqual('New Test Task');
  });

  it('POST /api/tasks fails without a title', async () => {
    const res = await request(app).post('/api/tasks').send({});
    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('error');
  });

  it('POST /api/tasks rejects a title of only spaces', async () => {
    const res = await request(app).post('/api/tasks').send({ title: '   ' });
    expect(res.statusCode).toEqual(400);
  });

  it('a created task appears in GET /api/tasks', async () => {
    await request(app).post('/api/tasks').send({ title: 'Check pipeline logs' });
    const res = await request(app).get('/api/tasks');
    const titles = res.body.map((t) => t.title);
    expect(titles).toContain('Check pipeline logs');
  });
});
