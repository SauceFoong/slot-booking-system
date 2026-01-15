import { Response } from 'express';
import { bookingService } from '../services';
import { AuthenticatedRequest, ApiResponse, AppError, NotFoundError } from '../types';
import { createBookingSchema, bookingFiltersSchema } from '../utils/validation';
import { StatusCodes } from 'http-status-codes';
import { addBookingJob } from '../queues';

// Check if queue is enabled
const USE_QUEUE = process.env.USE_BOOKING_QUEUE === 'true';

export class BookingController {
  /**
   * POST /bookings
   * Book an available slot
   * Uses queue for FCFS ordering when USE_BOOKING_QUEUE=true
   */
  async createBooking(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { userId } = req.user;
    const input = createBookingSchema.parse(req.body);

    if (USE_QUEUE) {
      // Queue-based booking for true FCFS
      const result = await addBookingJob(userId, input.slotId);

      if (!result.success && result.error) {
        throw new AppError(
          result.error.statusCode,
          result.error.code,
          result.error.message
        );
      }

      const response: ApiResponse = {
        success: true,
        data: result.data,
      };

      res.status(StatusCodes.CREATED).json(response);
    } else {
      // Direct booking (original behavior)
      const booking = await bookingService.createBooking(userId, input.slotId);

      const response: ApiResponse = {
        success: true,
        data: booking,
      };

      res.status(StatusCodes.CREATED).json(response);
    }
  }

  /**
   * GET /bookings
   * List user's bookings
   */
  async getUserBookings(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { userId } = req.user;
    const filters = bookingFiltersSchema.parse(req.query);

    const result = await bookingService.getUserBookings(userId, filters);

    const response: ApiResponse = {
      success: true,
      data: result.bookings,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
      },
    };

    res.status(StatusCodes.OK).json(response);
  }

  /**
   * GET /bookings/:id
   * Get a single booking by ID
   */
  async getBookingById(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { userId } = req.user;
    const id = req.params.id as string;

    const booking = await bookingService.getBookingById(userId, id);

    if (!booking) {
      throw new NotFoundError('Booking');
    }

    const response: ApiResponse = {
      success: true,
      data: booking,
    };

    res.status(StatusCodes.OK).json(response);
  }

  /**
   * DELETE /bookings/:id
   * Cancel a booking
   */
  async cancelBooking(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { userId } = req.user;
    const id = req.params.id as string;

    const booking = await bookingService.cancelBooking(userId, id);

    const response: ApiResponse = {
      success: true,
      data: booking,
    };

    res.status(StatusCodes.OK).json(response);
  }
}

export const bookingController = new BookingController();

