import { BookingStatus, SlotStatus } from '@prisma/client';
import prisma from '../utils/prisma';
import { bookingRepository, slotRepository, BookingWithDetails } from '../repositories';
import {
  BadRequestError,
  BookingFilters,
  BookingResponse,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../types';
import { MAX_ACTIVE_BOOKINGS, CANCELLATION_WINDOW_HOURS } from '../utils/constants';

export class BookingService {
  /**
   * Create a new booking with concurrency-safe handling
   * 
   * Uses PESSIMISTIC LOCKING (SELECT FOR UPDATE) to prevent race conditions.
   * This ensures that even if two users try to book the same slot simultaneously,
   * only one will succeed and the other will receive a clear conflict error.
   * 
   * Business Rules:
   * - User cannot book their own slot
   * - User can have at most MAX_ACTIVE_BOOKINGS active bookings
   * - User can only have one active booking per host
   * - Slot must be available and in the future
   */
  async createBooking(userId: string, slotId: string): Promise<BookingResponse> {
    // Use a transaction with pessimistic locking
    const booking = await prisma.$transaction(async (tx) => {
      // 1. Lock the slot row using SELECT FOR UPDATE
      //    This prevents concurrent transactions from modifying the same slot
      const slot = await slotRepository.findByIdForUpdate(tx, slotId);

      // 2. Validate slot exists
      if (!slot) {
        throw new NotFoundError('Slot');
      }

      // 3. Validate slot is available
      if (slot.status !== SlotStatus.AVAILABLE) {
        throw new ConflictError('Slot is no longer available');
      }

      // 4. Validate slot is in the future
      if (slot.startTime <= new Date()) {
        throw new BadRequestError('Cannot book a slot in the past');
      }

      // 5. Validate user is not booking their own slot
      if (slot.hostId === userId) {
        throw new BadRequestError('You cannot book your own slot');
      }

      // 6. Check user's active booking count
      const activeBookings = await bookingRepository.countActiveBookings(userId, tx);
      if (activeBookings >= MAX_ACTIVE_BOOKINGS) {
        throw new ConflictError(
          `You have reached the maximum of ${MAX_ACTIVE_BOOKINGS} active bookings`
        );
      }

      // 7. Check if user already has an active booking with this host
      const existingBookingWithHost = await bookingRepository.countActiveBookingsWithHost(
        userId,
        slot.hostId,
        tx
      );
      if (existingBookingWithHost > 0) {
        throw new ConflictError(
          'You already have an active booking with this host'
        );
      }

      // 8. Update slot status to BOOKED
      await slotRepository.updateStatus(slotId, SlotStatus.BOOKED, tx);

      // 9. Create the booking
      return bookingRepository.create(tx, { slotId, userId });
    }, {
      // Transaction options for better concurrency handling
      isolationLevel: 'Serializable', // Highest isolation level
      timeout: 10000, // 10 second timeout
    });

    // Fetch full booking details
    const bookingDetails = await bookingRepository.findByIdWithDetails(booking.id);
    
    if (!bookingDetails) {
      throw new Error('Booking created but could not be retrieved');
    }

    return this.formatBookingResponse(bookingDetails);
  }

  /**
   * Cancel a booking
   * 
   * Business Rules:
   * - Only the user who made the booking can cancel it
   * - Cancellation is only allowed more than CANCELLATION_WINDOW_HOURS before slot start
   */
  async cancelBooking(userId: string, bookingId: string): Promise<BookingResponse> {
    const booking = await bookingRepository.findByIdWithDetails(bookingId);

    if (!booking) {
      throw new NotFoundError('Booking');
    }

    // Verify ownership
    if (booking.userId !== userId) {
      throw new ForbiddenError('You can only cancel your own bookings');
    }

    // Check if already cancelled
    if (booking.status === BookingStatus.CANCELLED) {
      throw new ConflictError('Booking is already cancelled');
    }

    // Check cancellation window
    const now = new Date();
    const slotStartTime = new Date(booking.slot.startTime);
    const hoursUntilSlot = (slotStartTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilSlot < CANCELLATION_WINDOW_HOURS) {
      throw new BadRequestError(
        `Cancellation is only allowed at least ${CANCELLATION_WINDOW_HOURS} hour(s) before the slot start time`
      );
    }

    // Cancel the booking and make slot available again
    await prisma.$transaction(async (tx) => {
      await bookingRepository.updateStatus(bookingId, BookingStatus.CANCELLED, tx);
      await slotRepository.updateStatus(booking.slotId, SlotStatus.AVAILABLE, tx);
    });

    // Fetch updated booking
    const updatedBooking = await bookingRepository.findByIdWithDetails(bookingId);
    
    if (!updatedBooking) {
      throw new Error('Booking cancelled but could not be retrieved');
    }

    return this.formatBookingResponse(updatedBooking);
  }

  /**
   * Get bookings for a user
   */
  async getUserBookings(
    userId: string,
    filters: BookingFilters & { page?: number; limit?: number }
  ): Promise<{
    bookings: BookingResponse[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 20 } = filters;
    const result = await bookingRepository.findByUser(userId, { ...filters, page, limit });

    return {
      bookings: result.bookings.map((booking) => this.formatBookingResponse(booking)),
      total: result.total,
      page,
      limit,
    };
  }

  /**
   * Get a single booking by ID
   */
  async getBookingById(userId: string, bookingId: string): Promise<BookingResponse | null> {
    const booking = await bookingRepository.findByIdWithDetails(bookingId);

    if (!booking) {
      return null;
    }

    // Users can only view their own bookings
    if (booking.userId !== userId) {
      throw new ForbiddenError('You can only view your own bookings');
    }

    return this.formatBookingResponse(booking);
  }

  /**
   * Format booking data for API response
   */
  private formatBookingResponse(booking: BookingWithDetails): BookingResponse {
    return {
      id: booking.id,
      slotId: booking.slotId,
      userId: booking.userId,
      status: booking.status,
      slot: {
        id: booking.slot.id,
        hostId: booking.slot.hostId,
        hostName: booking.slot.host.name,
        startTime: booking.slot.startTime,
        endTime: booking.slot.endTime,
        status: booking.slot.status as SlotStatus,
      },
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
    };
  }
}

export const bookingService = new BookingService();

