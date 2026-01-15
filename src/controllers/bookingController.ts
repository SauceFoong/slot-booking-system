import { Response } from 'express';
import { bookingService } from '../services';
import { AuthenticatedRequest, ApiResponse, NotFoundError } from '../types';
import { createBookingSchema, bookingFiltersSchema } from '../utils/validation';
import { StatusCodes } from 'http-status-codes';

export class BookingController {
  /**
   * POST /bookings
   * Book an available slot
   */
  async createBooking(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { userId } = req.user;
    const input = createBookingSchema.parse(req.body);

    const booking = await bookingService.createBooking(userId, input.slotId);

    const response: ApiResponse = {
      success: true,
      data: booking,
    };

    res.status(StatusCodes.CREATED).json(response);
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

