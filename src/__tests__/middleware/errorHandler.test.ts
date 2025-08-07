import request from 'supertest';
import express from 'express';
import { errorHandler, notFound } from '../../middleware/errorHandler';

describe('Error Handler Middleware', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe('notFound middleware', () => {
    it('should return 404 for unknown routes', async () => {
      app.use(notFound);

      const response = await request(app)
        .get('/unknown-route');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Not found');
    });

    it('should include requested path in error', async () => {
      app.use(notFound);

      const response = await request(app)
        .get('/api/v1/unknown');

      expect(response.status).toBe(404);
      expect(response.body.path).toBe('/api/v1/unknown');
    });
  });

  describe('errorHandler middleware', () => {
    it('should handle validation errors', async () => {
      app.get('/test', (_req, _res, next) => {
        const error: any = new Error('Validation failed');
        error.type = 'validation';
        error.details = {
          field: 'email',
          message: 'Invalid email format',
        };
        next(error);
      });
      app.use(errorHandler);

      const response = await request(app)
        .get('/test');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toEqual({
        field: 'email',
        message: 'Invalid email format',
      });
    });

    it('should handle Prisma unique constraint errors', async () => {
      app.get('/test', (_req, _res, next) => {
        const error: any = new Error();
        error.code = 'P2002';
        error.meta = { target: ['email'] };
        next(error);
      });
      app.use(errorHandler);

      const response = await request(app)
        .get('/test');

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('already exists');
    });

    it('should handle Prisma record not found errors', async () => {
      app.get('/test', (_req, _res, next) => {
        const error: any = new Error();
        error.code = 'P2025';
        next(error);
      });
      app.use(errorHandler);

      const response = await request(app)
        .get('/test');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Record not found');
    });

    it('should handle generic errors', async () => {
      app.get('/test', (_req, _res, next) => {
        next(new Error('Something went wrong'));
      });
      app.use(errorHandler);

      const response = await request(app)
        .get('/test');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Something went wrong');
    });

    it('should hide error details in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      app.get('/test', (_req, _res, next) => {
        next(new Error('Sensitive error message'));
      });
      app.use(errorHandler);

      const response = await request(app)
        .get('/test');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal Server Error');
      expect(response.body.message).toBeUndefined();

      process.env.NODE_ENV = originalEnv;
    });

    it('should handle errors without message', async () => {
      app.get('/test', (_req, _res, next) => {
        const error: any = new Error();
        error.statusCode = 403;
        next(error);
      });
      app.use(errorHandler);

      const response = await request(app)
        .get('/test');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Forbidden');
    });

    it('should log errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      app.get('/test', (_req, _res, next) => {
        next(new Error('Test error'));
      });
      app.use(errorHandler);

      await request(app).get('/test');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('JSON parsing errors', () => {
    it('should handle malformed JSON', async () => {
      app.use(express.json());
      app.post('/test', (req, res) => {
        res.json({ received: req.body });
      });
      app.use(errorHandler);

      const response = await request(app)
        .post('/test')
        .set('Content-Type', 'application/json')
        .send('{ invalid json');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('JSON');
    });
  });
});