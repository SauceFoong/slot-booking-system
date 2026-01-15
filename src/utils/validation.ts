import { z } from 'zod';
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from './constants';

// ============================================================================
// Common Schemas
// ============================================================================

export const uuidSchema = z.string().uuid('Invalid UUID format');

export const dateSchema = z.coerce.date();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(DEFAULT_PAGE_LIMIT),
});

// ============================================================================
// Slot Schemas
// ============================================================================

export const createSlotSchema = z.object({
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
}).refine(
  (data) => data.endTime > data.startTime,
  { message: 'End time must be after start time', path: ['endTime'] }
).refine(
  (data) => data.startTime > new Date(),
  { message: 'Start time must be in the future', path: ['startTime'] }
);

export const slotFiltersSchema = z.object({
  hostId: z.string().uuid().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  status: z.enum(['AVAILABLE', 'BOOKED', 'CANCELLED']).optional(),
}).merge(paginationSchema);

// ============================================================================
// Booking Schemas
// ============================================================================

export const createBookingSchema = z.object({
  slotId: z.string().uuid('Invalid slot ID'),
});

export const bookingFiltersSchema = z.object({
  status: z.enum(['CONFIRMED', 'CANCELLED']).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
}).merge(paginationSchema);

// ============================================================================
// Analytics Schemas
// ============================================================================

export const analyticsFiltersSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
}).refine(
  (data) => data.endDate >= data.startDate,
  { message: 'End date must be on or after start date', path: ['endDate'] }
);

// ============================================================================
// User Schemas
// ============================================================================

export const createUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  roles: z.array(z.enum(['HOST', 'GUEST'])).min(1, 'At least one role is required').default(['GUEST']),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateSlotInput = z.infer<typeof createSlotSchema>;
export type SlotFiltersInput = z.infer<typeof slotFiltersSchema>;
export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type BookingFiltersInput = z.infer<typeof bookingFiltersSchema>;
export type AnalyticsFiltersInput = z.infer<typeof analyticsFiltersSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;

