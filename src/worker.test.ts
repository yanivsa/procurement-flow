import { describe, it, expect } from 'vitest';
import worker from './worker';

describe('Admin Authentication', () => {
  it('should return 500 if ADMIN_TOKEN is not set', async () => {
    const env = {
      PROCUREMENT_DB: {} as any,
      PROCUREMENT_FILES_BUCKET: {} as any,
    };
    const req = new Request('http://localhost/admin');
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).toContain('Server configuration error');
  });

  it('should return 403 if adminToken is invalid', async () => {
    const env = {
      PROCUREMENT_DB: {} as any,
      PROCUREMENT_FILES_BUCKET: {} as any,
      ADMIN_TOKEN: 'secret123',
    };
    const req = new Request('http://localhost/admin?adminToken=wrong');
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(403);
  });

  it('should proceed if adminToken is valid (mock DB error)', async () => {
    const env = {
      PROCUREMENT_DB: {
        prepare: () => ({
          all: async () => ({ error: 'Mock DB error' })
        })
      } as any,
      PROCUREMENT_FILES_BUCKET: {} as any,
      ADMIN_TOKEN: 'secret123',
    };
    const req = new Request('http://localhost/admin?adminToken=secret123');
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).toContain('Mock DB error');
  });
});
