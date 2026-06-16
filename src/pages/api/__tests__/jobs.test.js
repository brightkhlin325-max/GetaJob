import { createMocks } from 'node-mocks-http';
import jobsHandler from '../jobs';
import db from '../../../lib/db';

describe('/api/jobs API Endpoint', () => {
  beforeEach(async () => {
    await db.prepare('DELETE FROM job_analyses').run();
    await db.prepare('DELETE FROM jobs').run();
    await db.prepare('DELETE FROM resumes').run();
    await db.prepare('DELETE FROM settings').run();
  });

  test('POST - should create a new job and return 201 with jobId', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        title: 'Frontend Developer',
        company: 'Bauhaus Tech',
        location: 'Taipei',
        salary: '100k',
        url: 'https://example.com/job',
        description: 'React developer position',
        source: 'LinkedIn',
      },
    });

    await jobsHandler(req, res);

    expect(res._getStatusCode()).toBe(201);
    const data = res._getJSONData();
    expect(data.success).toBe(true);
    expect(data.jobId).toBeDefined();

    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(data.jobId);
    expect(job).toBeDefined();
    expect(job.title).toBe('Frontend Developer');
    expect(job.company).toBe('Bauhaus Tech');
    expect(job.status).toBe('Interested');
  });

  test('POST - should reject payload if title or company is missing', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        title: 'Frontend Developer',
      },
    });

    await jobsHandler(req, res);

    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData().success).toBe(false);
  });

  test('POST - should reject payload if status is invalid', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        title: 'Frontend Developer',
        company: 'Bauhaus Tech',
        status: 'SuperInterested',
      },
    });

    await jobsHandler(req, res);

    expect(res._getStatusCode()).toBe(400);
  });

  test('GET - should return all jobs ordered by created_at DESC', async () => {
    await db.prepare("INSERT INTO jobs (title, company, status) VALUES ('Job A', 'Company A', 'Interested')").run();
    await db.prepare("INSERT INTO jobs (title, company, status) VALUES ('Job B', 'Company B', 'Applied')").run();

    const { req, res } = createMocks({
      method: 'GET',
    });

    await jobsHandler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const data = res._getJSONData();
    expect(data.success).toBe(true);
    expect(data.data.length).toBe(2);
    expect(data.data[0].title).toBe('Job B');
    expect(data.data[1].title).toBe('Job A');
  });

  test('GET - should filter jobs by status', async () => {
    await db.prepare("INSERT INTO jobs (title, company, status) VALUES ('Job A', 'Company A', 'Interested')").run();
    await db.prepare("INSERT INTO jobs (title, company, status) VALUES ('Job B', 'Company B', 'Applied')").run();

    const { req, res } = createMocks({
      method: 'GET',
      query: { status: 'Applied' },
    });

    await jobsHandler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const data = res._getJSONData();
    expect(data.success).toBe(true);
    expect(data.data.length).toBe(1);
    expect(data.data[0].title).toBe('Job B');
  });

  test('GET - should return single job with analyses', async () => {
    const jobResult = await db.prepare("INSERT INTO jobs (title, company, status) VALUES ('Job A', 'Company A', 'Interested')").run();
    const jobId = jobResult.lastInsertRowid;

    const resumeResult = await db.prepare("INSERT INTO resumes (file_name, raw_text, parsed_json) VALUES ('resume.pdf', 'raw', '{}')").run();
    const resumeId = resumeResult.lastInsertRowid;

    await db.prepare("INSERT INTO job_analyses (job_id, resume_id, match_score) VALUES (?, ?, ?)").run(jobId, resumeId, 95);

    const { req, res } = createMocks({
      method: 'GET',
      query: { id: jobId },
    });

    await jobsHandler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const data = res._getJSONData();
    expect(data.success).toBe(true);
    expect(data.data.title).toBe('Job A');
    expect(data.data.analyses.length).toBe(1);
    expect(data.data.analyses[0].match_score).toBe(95);
  });

  test('PUT - should update job details successfully', async () => {
    const jobResult = await db.prepare("INSERT INTO jobs (title, company, status) VALUES ('Job A', 'Company A', 'Interested')").run();
    const jobId = jobResult.lastInsertRowid;

    const { req, res } = createMocks({
      method: 'PUT',
      body: {
        id: jobId,
        title: 'Updated Title',
        status: 'Interviewing',
      },
    });

    await jobsHandler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData().success).toBe(true);

    const updatedJob = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
    expect(updatedJob.title).toBe('Updated Title');
    expect(updatedJob.company).toBe('Company A');
    expect(updatedJob.status).toBe('Interviewing');
  });

  test('DELETE - should remove job from db', async () => {
    const jobResult = await db.prepare("INSERT INTO jobs (title, company, status) VALUES ('Job A', 'Company A', 'Interested')").run();
    const jobId = jobResult.lastInsertRowid;

    const { req, res } = createMocks({
      method: 'DELETE',
      query: { id: jobId },
    });

    await jobsHandler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData().success).toBe(true);

    const deletedJob = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
    expect(deletedJob).toBeUndefined();
  });

  test('POST - should return 400 for invalid status values (empty string, null, invalid names)', async () => {
    const invalidStatuses = ['', null, 'SuperInterested', 'InvalidStatus'];
    for (const status of invalidStatuses) {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          title: 'Frontend Developer',
          company: 'Bauhaus Tech',
          status,
        },
      });

      await jobsHandler(req, res);
      expect(res._getStatusCode()).toBe(400);
      expect(res._getJSONData().success).toBe(false);
    }
  });

  test('PUT - should return 400 for invalid status values (empty string, null, invalid names)', async () => {
    const jobResult = db.prepare("INSERT INTO jobs (title, company, status) VALUES ('Job A', 'Company A', 'Interested')").run();
    const jobId = jobResult.lastInsertRowid;

    const invalidStatuses = ['', null, 'SuperInterested', 'InvalidStatus'];
    for (const status of invalidStatuses) {
      const { req, res } = createMocks({
        method: 'PUT',
        body: {
          id: jobId,
          status,
        },
      });

      await jobsHandler(req, res);
      expect(res._getStatusCode()).toBe(400);
      expect(res._getJSONData().success).toBe(false);
    }
  });

  test('POST - should return 400 for null/invalid title and company values', async () => {
    const invalidInputs = [
      { title: null, company: 'Company A' },
      { title: 'Title A', company: null },
      { title: 123, company: 'Company A' },
      { title: 'Title A', company: {} },
      { title: '', company: 'Company A' },
      { title: 'Title A', company: '   ' },
    ];

    for (const body of invalidInputs) {
      const { req, res } = createMocks({
        method: 'POST',
        body,
      });

      await jobsHandler(req, res);
      expect(res._getStatusCode()).toBe(400);
      expect(res._getJSONData().success).toBe(false);
    }
  });

  test('PUT - should return 400 for null/invalid title and company values', async () => {
    const jobResult = db.prepare("INSERT INTO jobs (title, company, status) VALUES ('Job A', 'Company A', 'Interested')").run();
    const jobId = jobResult.lastInsertRowid;

    const invalidInputs = [
      { title: null },
      { company: null },
      { title: 123 },
      { company: {} },
      { title: '' },
      { company: '   ' },
    ];

    for (const body of invalidInputs) {
      const { req, res } = createMocks({
        method: 'PUT',
        body: {
          id: jobId,
          ...body,
        },
      });

      await jobsHandler(req, res);
      expect(res._getStatusCode()).toBe(400);
      expect(res._getJSONData().success).toBe(false);
    }
  });

  test('GET - should return 400 if duplicate query ID array inputs are passed', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      query: { id: ['1', '2'] },
    });

    await jobsHandler(req, res);
    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData().success).toBe(false);
  });

  test('PUT - should return 400 if duplicate ID array inputs are passed', async () => {
    const { req, res } = createMocks({
      method: 'PUT',
      body: { id: [1, 2], title: 'Foo' },
    });

    await jobsHandler(req, res);
    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData().success).toBe(false);
  });

  test('DELETE - should return 400 if duplicate ID query parameters are passed', async () => {
    const { req, res } = createMocks({
      method: 'DELETE',
      query: { id: ['1', '2'] },
    });

    await jobsHandler(req, res);
    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData().success).toBe(false);
  });
});
