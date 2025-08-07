import { Router } from 'express';

/**
 * Example of how to handle multiple API versions
 * 
 * Usage:
 * const authRouter = createVersionedRouter({
 *   v1: authRoutesV1,
 *   v2: authRoutesV2
 * });
 * app.use('/api', authRouter);
 */

export interface VersionedRoutes {
  [version: string]: Router;
}

export const createVersionedRouter = (routes: VersionedRoutes): Router => {
  const router = Router();
  
  Object.entries(routes).forEach(([version, versionRouter]) => {
    router.use(`/${version}`, versionRouter);
  });
  
  return router;
};

// Helper to deprecate old API versions
export const deprecationWarning = (version: string, deprecationDate: string) => {
  return (_req: any, res: any, next: any) => {
    res.setHeader('X-API-Deprecation', `true`);
    res.setHeader('X-API-Deprecation-Date', deprecationDate);
    res.setHeader('X-API-Deprecation-Info', `API ${version} is deprecated. Please migrate to a newer version.`);
    next();
  };
};