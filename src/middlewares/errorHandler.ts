import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError, ApiResponse } from '../types';

/**
 * Global error handler middleware.
 * Catches all errors and returns a consistent API response format.
 */
export const errorHandler: ErrorRequestHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Safely log error (avoid circular reference issues with complex objects)
  console.error('Error:', err.message, err.stack);

  // Handle our custom AppError
  if (err instanceof AppError) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    };
    res.status(err.statusCode).json(response);
    return;
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: err.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      },
    };
    res.status(400).json(response);
    return;
  }

  // Handle Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    let statusCode = 500;
    let code = 'DATABASE_ERROR';
    let message = 'Database error occurred';

    switch (err.code) {
      case 'P2002': // Unique constraint violation
        statusCode = 409;
        code = 'CONFLICT';
        message = 'A record with this value already exists';
        break;
      case 'P2025': // Record not found
        statusCode = 404;
        code = 'NOT_FOUND';
        message = 'Record not found';
        break;
      case 'P2003': // Foreign key constraint violation
        statusCode = 400;
        code = 'INVALID_REFERENCE';
        message = 'Referenced record does not exist';
        break;
      case 'P2034': // Transaction conflict / write conflict / deadlock
        statusCode = 409;
        code = 'TRANSACTION_CONFLICT';
        message = 'Slot is no longer available';
        break;
    }

    // Handle PostgreSQL serialization failure (error code 40001) from raw queries
    // This happens during concurrent SELECT FOR UPDATE operations
    if (err.message.includes('could not serialize access') || 
        err.message.includes('40001') ||
        err.message.includes('deadlock') ||
        err.message.includes('write conflict')) {
      statusCode = 409;
      code = 'CONFLICT';
      message = 'Slot is no longer available';
    }

    // Handle exclusion constraint violation (slot overlap)
    if (err.code === 'P2010' && err.message.includes('slot_no_overlap')) {
      statusCode = 409;
      code = 'SLOT_OVERLAP';
      message = 'Slot overlaps with an existing slot for this host';
    }

    const response: ApiResponse = {
      success: false,
      error: { code, message },
    };
    res.status(statusCode).json(response);
    return;
  }

  // Handle Prisma validation errors
  if (err instanceof Prisma.PrismaClientValidationError) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid data provided',
      },
    };
    res.status(400).json(response);
    return;
  }

  // Handle unknown errors
  const response: ApiResponse = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' 
        ? 'An unexpected error occurred' 
        : err.message,
    },
  };
  res.status(500).json(response);
};

/**
 * 404 Not Found handler for undefined routes
 */
export const notFoundHandler = (_req: Request, res: Response): void => {
  const response: ApiResponse = {
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'The requested endpoint does not exist',
    },
  };
  res.status(404).json(response);
};

