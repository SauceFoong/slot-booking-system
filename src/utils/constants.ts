// ============================================================================
// Business Rule Constants
// ============================================================================

/**
 * Maximum number of active (upcoming, confirmed) bookings a user can have
 */
export const MAX_ACTIVE_BOOKINGS = 5;

/**
 * Minimum hours before slot start time when cancellation is allowed
 */
export const CANCELLATION_WINDOW_HOURS = 1;

/**
 * Default pagination limit
 */
export const DEFAULT_PAGE_LIMIT = 20;

/**
 * Maximum pagination limit
 */
export const MAX_PAGE_LIMIT = 100;

// ============================================================================
// Error Codes
// ============================================================================

export const ErrorCodes = {
  // Validation errors
  INVALID_INPUT: 'INVALID_INPUT',
  INVALID_DATE_RANGE: 'INVALID_DATE_RANGE',
  
  // Slot errors
  SLOT_NOT_FOUND: 'SLOT_NOT_FOUND',
  SLOT_NOT_AVAILABLE: 'SLOT_NOT_AVAILABLE',
  SLOT_OVERLAP: 'SLOT_OVERLAP',
  SLOT_IN_PAST: 'SLOT_IN_PAST',
  SLOT_HAS_BOOKING: 'SLOT_HAS_BOOKING',
  
  // Booking errors
  BOOKING_NOT_FOUND: 'BOOKING_NOT_FOUND',
  BOOKING_OWN_SLOT: 'BOOKING_OWN_SLOT',
  MAX_BOOKINGS_REACHED: 'MAX_BOOKINGS_REACHED',
  CANCELLATION_NOT_ALLOWED: 'CANCELLATION_NOT_ALLOWED',
  ALREADY_CANCELLED: 'ALREADY_CANCELLED',
  
  // Auth errors
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  NOT_A_HOST: 'NOT_A_HOST',
  
  // System errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

