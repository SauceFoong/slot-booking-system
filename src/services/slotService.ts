import { SlotStatus, UserRole } from '@prisma/client';
import { slotRepository } from '../repositories';
import { userRepository } from '../repositories';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  SlotFilters,
  SlotResponse,
} from '../types';

export class SlotService {
  /**
   * Create a new available slot
   * Business Rules:
   * - User must be a HOST
   * - Slot must be in the future
   * - Slot must not overlap with existing slots for the same host
   */
  async createSlot(
    hostId: string,
    data: { startTime: Date; endTime: Date }
  ): Promise<SlotResponse> {
    // Verify user has HOST role
    const isHost = await userRepository.hasRole(hostId, UserRole.HOST);
    if (!isHost) {
      throw new ForbiddenError('Only hosts can create slots');
    }

    // Validate time range
    if (data.endTime <= data.startTime) {
      throw new BadRequestError('End time must be after start time');
    }

    if (data.startTime <= new Date()) {
      throw new BadRequestError('Slot start time must be in the future');
    }

    // Check for overlapping slots (defense-in-depth, DB constraint also enforces this)
    const hasOverlap = await slotRepository.hasOverlap(
      hostId,
      data.startTime,
      data.endTime
    );
    if (hasOverlap) {
      throw new ConflictError('Slot overlaps with an existing slot');
    }

    // Create the slot
    const slot = await slotRepository.create({
      hostId,
      startTime: data.startTime,
      endTime: data.endTime,
    });

    const host = await userRepository.findById(hostId);

    return {
      id: slot.id,
      hostId: slot.hostId,
      hostName: host?.name,
      startTime: slot.startTime,
      endTime: slot.endTime,
      status: slot.status,
      createdAt: slot.createdAt,
      updatedAt: slot.updatedAt,
    };
  }

  /**
   * Get available slots with optional filters
   */
  async getAvailableSlots(
    filters: SlotFilters & { page?: number; limit?: number }
  ): Promise<{
    slots: SlotResponse[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 20 } = filters;
    const result = await slotRepository.findAvailable({ ...filters, page, limit });

    return {
      slots: result.slots.map((slot) => ({
        id: slot.id,
        hostId: slot.hostId,
        hostName: slot.host.name,
        startTime: slot.startTime,
        endTime: slot.endTime,
        status: slot.status,
        createdAt: slot.createdAt,
        updatedAt: slot.updatedAt,
      })),
      total: result.total,
      page,
      limit,
    };
  }

  /**
   * Get all slots for a host (including booked/cancelled)
   */
  async getHostSlots(
    hostId: string,
    filters: { status?: SlotStatus; page?: number; limit?: number }
  ): Promise<{
    slots: Array<SlotResponse & { bookingId?: string; bookedByUserId?: string }>;
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 20 } = filters;
    const result = await slotRepository.findByHost(hostId, { ...filters, page, limit });

    return {
      slots: result.slots.map((slot) => {
        // Get the confirmed booking (if any) - only one confirmed booking per slot
        const confirmedBooking = slot.bookings[0];
        return {
          id: slot.id,
          hostId: slot.hostId,
          startTime: slot.startTime,
          endTime: slot.endTime,
          status: slot.status,
          createdAt: slot.createdAt,
          updatedAt: slot.updatedAt,
          bookingId: confirmedBooking?.id,
          bookedByUserId: confirmedBooking?.userId,
        };
      }),
      total: result.total,
      page,
      limit,
    };
  }

  /**
   * Delete/cancel an unbooked slot
   * Business Rules:
   * - Only the slot owner can delete it
   * - Slot must not be booked
   */
  async deleteSlot(hostId: string, slotId: string): Promise<void> {
    const slot = await slotRepository.findByIdWithHost(slotId);

    if (!slot) {
      throw new NotFoundError('Slot');
    }

    // Verify ownership
    if (slot.hostId !== hostId) {
      throw new ForbiddenError('You can only delete your own slots');
    }

    // Check if slot is booked
    if (slot.status === SlotStatus.BOOKED) {
      throw new ConflictError('Cannot delete a booked slot');
    }

    // If slot is already cancelled, just return success
    if (slot.status === SlotStatus.CANCELLED) {
      return;
    }

    // Delete the slot (or mark as cancelled)
    await slotRepository.delete(slotId);
  }

  /**
   * Get a single slot by ID
   */
  async getSlotById(slotId: string): Promise<SlotResponse | null> {
    const slot = await slotRepository.findByIdWithHost(slotId);

    if (!slot) {
      return null;
    }

    return {
      id: slot.id,
      hostId: slot.hostId,
      hostName: slot.host.name,
      startTime: slot.startTime,
      endTime: slot.endTime,
      status: slot.status,
      createdAt: slot.createdAt,
      updatedAt: slot.updatedAt,
    };
  }
}

export const slotService = new SlotService();

