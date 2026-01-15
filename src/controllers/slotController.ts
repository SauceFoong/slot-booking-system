import { Response } from 'express';
import { slotService } from '../services';
import { AuthenticatedRequest, ApiResponse, NotFoundError } from '../types';
import { createSlotSchema, slotFiltersSchema } from '../utils/validation';
import { StatusCodes } from 'http-status-codes';

export class SlotController {
  /**
   * POST /slots
   * Create a new available slot
   */
  async createSlot(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { userId } = req.user;
    const input = createSlotSchema.parse(req.body);

    const slot = await slotService.createSlot(userId, input);

    const response: ApiResponse = {
      success: true,
      data: slot,
    };

    res.status(StatusCodes.CREATED).json(response);
  }

  /**
   * GET /slots
   * List available slots with optional filters
   */
  async getAvailableSlots(req: AuthenticatedRequest, res: Response): Promise<void> {
    const filters = slotFiltersSchema.parse(req.query);

    const result = await slotService.getAvailableSlots(filters);

    const response: ApiResponse = {
      success: true,
      data: result.slots,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
      },
    };

    res.status(StatusCodes.OK).json(response);
  }

  /**
   * GET /slots/host
   * List all slots for the authenticated host
   */
  async getHostSlots(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { userId } = req.user;
    const filters = slotFiltersSchema.parse(req.query);

    const result = await slotService.getHostSlots(userId, filters);

    const response: ApiResponse = {
      success: true,
      data: result.slots,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
      },
    };

    res.status(StatusCodes.OK).json(response);
  }

  /**
   * GET /slots/:id
   * Get a single slot by ID
   */
  async getSlotById(req: AuthenticatedRequest, res: Response): Promise<void> {
    const id = req.params.id as string;

    const slot = await slotService.getSlotById(id);

    if (!slot) {
      throw new NotFoundError('Slot');
    }

    const response: ApiResponse = {
      success: true,
      data: slot,
    };

    res.status(StatusCodes.OK).json(response);
  }

  /**
   * DELETE /slots/:id
   * Delete/cancel an unbooked slot
   */
  async deleteSlot(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { userId } = req.user;
    const id = req.params.id as string;

    await slotService.deleteSlot(userId, id);

    const response: ApiResponse = {
      success: true,
      data: { message: 'Slot deleted successfully' },
    };

    res.status(StatusCodes.OK).json(response);
  }
}

export const slotController = new SlotController();

