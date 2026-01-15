import { Request } from 'express';
import { BookingStatus, SlotStatus, UserRole } from '@prisma/client';

// ============================================================================
// User Context
// ============================================================================

export interface UserContext {
  userId: string;
}

export interface AuthenticatedRequest extends Request {
  user: UserContext;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

// ============================================================================
// Slot Types
// ============================================================================

export interface CreateSlotInput {
  startTime: Date;
  endTime: Date;
}

export interface SlotFilters {
  hostId?: string;
  startDate?: Date;
  endDate?: Date;
  status?: SlotStatus;
}

export interface SlotResponse {
  id: string;
  hostId: string;
  hostName?: string;
  startTime: Date;
  endTime: Date;
  status: SlotStatus;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Booking Types
// ============================================================================

export interface CreateBookingInput {
  slotId: string;
}

export interface BookingFilters {
  status?: BookingStatus;
  startDate?: Date;
  endDate?: Date;
}

export interface BookingResponse {
  id: string;
  slotId: string;
  userId: string;
  status: BookingStatus;
  slot: {
    id: string;
    hostId: string;
    hostName?: string;
    startTime: Date;
    endTime: Date;
    status: SlotStatus;
  };
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Analytics Types
// ============================================================================

export interface AnalyticsFilters {
  startDate: Date;
  endDate: Date;
}

export interface AnalyticsResponse {
  totalBookings: number;
  cancellationRate: number;
  bookingsPerDay: Array<{
    date: string;
    count: number;
  }>;
  topHosts: Array<{
    hostId: string;
    hostName: string;
    bookingCount: number;
  }>;
}

// ============================================================================
// User Types
// ============================================================================

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  roles: UserRole[];
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Error Types
// ============================================================================

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, details?: unknown) {
    super(400, 'BAD_REQUEST', message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(403, 'FORBIDDEN', message);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, 'NOT_FOUND', `${resource} not found`);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, 'CONFLICT', message);
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message: string, details?: unknown) {
    super(422, 'UNPROCESSABLE_ENTITY', message, details);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests') {
    super(429, 'TOO_MANY_REQUESTS', message);
  }
}

