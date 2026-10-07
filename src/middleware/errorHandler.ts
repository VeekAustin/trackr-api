import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof AppError) {
    logger.warn('handled error', {
      message: err.message,
      statusCode: err.statusCode,
      code: err.code,
      path: req.originalUrl,
      method: req.method,
    });

    return res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        code: err.code,
      },
    });
  }

  // anything unexpected is a genuine bug — log it loudly, full stack trace
  logger.error('unhandled error', {
    message: err.message,
    stack: err.stack,
    path: req.originalUrl,
    method: req.method,
  });

  res.status(500).json({
    success: false,
    error: {
      message: 'Something went wrong',
    },
  });
};

export const notFound = (req: Request, res: Response, next: NextFunction) => {
  res.status(404).json({
    success: false,
    error: {
      message: `Route not found: ${req.originalUrl}`,
    },
  });
};