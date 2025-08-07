import { Request, Response, NextFunction } from 'express';

export interface VersionedRequest extends Request {
  apiVersion?: string;
}

export const extractApiVersion = (req: VersionedRequest, res: Response, next: NextFunction): void => {
  // Extract version from URL path
  const versionMatch = req.path.match(/^\/api\/(v\d+)\//);
  
  if (versionMatch) {
    req.apiVersion = versionMatch[1];
  } else {
    req.apiVersion = 'v1'; // Default version
  }
  
  // Add version to response headers
  res.setHeader('X-API-Version', req.apiVersion);
  
  next();
};

export const requireApiVersion = (supportedVersions: string[]) => {
  return (req: VersionedRequest, res: Response, next: NextFunction): void => {
    const version = req.apiVersion || 'v1';
    
    if (!supportedVersions.includes(version)) {
      res.status(400).json({
        error: 'Unsupported API version',
        supportedVersions,
        requestedVersion: version
      });
      return;
    }
    
    next();
  };
};