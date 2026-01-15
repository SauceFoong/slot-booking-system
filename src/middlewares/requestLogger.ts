import { Request, Response, NextFunction } from 'express';

/**
 * Simple request logging middleware for development and debugging.
 */
export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const start = Date.now();

  // Log when response is finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? 'error' : 'info';
    
    const logMessage = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      userId: req.headers['x-user-id'] || 'anonymous',
    };

    if (logLevel === 'error') {
      console.error('[REQUEST]', JSON.stringify(logMessage));
    } else {
      console.log('[REQUEST]', JSON.stringify(logMessage));
    }
  });

  next();
};

