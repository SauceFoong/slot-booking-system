import { Slot, SlotStatus, Prisma } from '@prisma/client';
import prisma from '../utils/prisma';
import { SlotFilters } from '../types';

// Type for transaction client
type TransactionClient = Prisma.TransactionClient;

export class SlotRepository {
  /**
   * Find a slot by ID
   */
  async findById(id: string): Promise<Slot | null> {
    return prisma.slot.findUnique({
      where: { id },
    });
  }

  /**
   * Find a slot by ID with host information
   */
  async findByIdWithHost(id: string): Promise<(Slot & { host: { id: string; name: string } }) | null> {
    return prisma.slot.findUnique({
      where: { id },
      include: {
        host: {
          select: { id: true, name: true },
        },
      },
    });
  }

  /**
   * Find a slot by ID with pessimistic lock (FOR UPDATE)
   * Must be called within a transaction
   */
  async findByIdForUpdate(
    tx: TransactionClient,
    id: string
  ): Promise<Slot | null> {
    const result = await tx.$queryRaw<Slot[]>`
      SELECT * FROM "Slot" WHERE id = ${id} FOR UPDATE
    `;
    return result[0] ?? null;
  }

  /**
   * Create a new slot
   */
  async create(data: {
    hostId: string;
    startTime: Date;
    endTime: Date;
    status?: SlotStatus;
  }): Promise<Slot> {
    return prisma.slot.create({
      data: {
        hostId: data.hostId,
        startTime: data.startTime,
        endTime: data.endTime,
        status: data.status ?? SlotStatus.AVAILABLE,
      },
    });
  }

  /**
   * Update a slot's status
   */
  async updateStatus(
    id: string,
    status: SlotStatus,
    tx?: TransactionClient
  ): Promise<Slot> {
    const client = tx ?? prisma;
    return client.slot.update({
      where: { id },
      data: { status },
    });
  }

  /**
   * Delete a slot
   */
  async delete(id: string): Promise<void> {
    await prisma.slot.delete({
      where: { id },
    });
  }

  /**
   * Find available slots with filters
   */
  async findAvailable(filters: SlotFilters & { page?: number; limit?: number }): Promise<{
    slots: Array<Slot & { host: { id: string; name: string } }>;
    total: number;
  }> {
    const { hostId, startDate, endDate, status, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.SlotWhereInput = {
      ...(status && { status }),
      startTime: {
        ...(startDate && { gte: startDate }),
        ...(endDate && { lte: endDate }),
      },
      ...(hostId && { hostId }),
    };

    const [slots, total] = await Promise.all([
      prisma.slot.findMany({
        where,
        include: {
          host: {
            select: { id: true, name: true },
          },
        },
        orderBy: { startTime: 'asc' },
        skip,
        take: limit,
      }),
      prisma.slot.count({ where }),
    ]);

    return { slots, total };
  }

  /**
   * Find all slots for a host (including non-available)
   */
  async findByHost(
    hostId: string,
    filters: { status?: SlotStatus; page?: number; limit?: number }
  ): Promise<{
    slots: Array<Slot & { bookings: Array<{ id: string; userId: string; status: string }> }>;
    total: number;
  }> {
    const { status, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.SlotWhereInput = {
      hostId,
      ...(status && { status }),
    };

    const [slots, total] = await Promise.all([
      prisma.slot.findMany({
        where,
        include: {
          bookings: {
            select: { id: true, userId: true, status: true },
            where: { status: 'CONFIRMED' },
          },
        },
        orderBy: { startTime: 'asc' },
        skip,
        take: limit,
      }),
      prisma.slot.count({ where }),
    ]);

    return { slots, total };
  }

  /**
   * Check if a slot overlaps with existing slots for a host
   * This is a fallback check in addition to the database constraint
   */
  async hasOverlap(
    hostId: string,
    startTime: Date,
    endTime: Date,
  ): Promise<boolean> {
    const overlapping = await prisma.slot.findFirst({
      where: {
        hostId,
        status: { not: SlotStatus.CANCELLED },
        OR: [
          {
            // New slot starts during existing slot
            startTime: { lte: startTime },
            endTime: { gt: startTime },
          },
          {
            // New slot ends during existing slot
            startTime: { lt: endTime },
            endTime: { gte: endTime },
          },
          {
            // New slot completely contains existing slot
            startTime: { gte: startTime },
            endTime: { lte: endTime },
          },
        ],
      },
    });

    return overlapping !== null;
  }
}

export const slotRepository = new SlotRepository();

