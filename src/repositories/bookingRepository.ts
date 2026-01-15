import { Booking, BookingStatus, Prisma, PrismaClient } from '@prisma/client';
import prisma from '../utils/prisma';
import { BookingFilters } from '../types';

// Type for transaction client
type TransactionClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

// Type for booking with slot and host info
export type BookingWithDetails = Booking & {
  slot: {
    id: string;
    hostId: string;
    startTime: Date;
    endTime: Date;
    status: string;
    host: {
      id: string;
      name: string;
    };
  };
};

export class BookingRepository {
  /**
   * Find a booking by ID
   */
  async findById(id: string): Promise<Booking | null> {
    return prisma.booking.findUnique({
      where: { id },
    });
  }

  /**
   * Find a booking by ID with full details
   */
  async findByIdWithDetails(id: string): Promise<BookingWithDetails | null> {
    return prisma.booking.findUnique({
      where: { id },
      include: {
        slot: {
          include: {
            host: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });
  }

  /**
   * Create a new booking
   * Must be called within a transaction
   */
  async create(
    tx: TransactionClient,
    data: {
      slotId: string;
      userId: string;
    }
  ): Promise<Booking> {
    return tx.booking.create({
      data: {
        slotId: data.slotId,
        userId: data.userId,
        status: BookingStatus.CONFIRMED,
      },
    });
  }

  /**
   * Update booking status
   */
  async updateStatus(
    id: string,
    status: BookingStatus,
    tx?: TransactionClient
  ): Promise<Booking> {
    const client = tx ?? prisma;
    return client.booking.update({
      where: { id },
      data: { status },
    });
  }

  /**
   * Count active bookings for a user
   * Active = CONFIRMED and slot start time is in the future
   */
  async countActiveBookings(
    userId: string,
    tx?: TransactionClient
  ): Promise<number> {
    const client = tx ?? prisma;
    return client.booking.count({
      where: {
        userId,
        status: BookingStatus.CONFIRMED,
        slot: {
          startTime: { gt: new Date() },
        },
      },
    });
  }

  /**
   * Find bookings for a user
   */
  async findByUser(
    userId: string,
    filters: BookingFilters & { page?: number; limit?: number }
  ): Promise<{
    bookings: BookingWithDetails[];
    total: number;
  }> {
    const { status, startDate, endDate, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.BookingWhereInput = {
      userId,
      ...(status && { status }),
      ...(startDate || endDate) && {
        slot: {
          ...(startDate && { startTime: { gte: startDate } }),
          ...(endDate && { startTime: { lte: endDate } }),
        },
      },
    };

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          slot: {
            include: {
              host: {
                select: { id: true, name: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.booking.count({ where }),
    ]);

    return { bookings, total };
  }

  /**
   * Find booking by slot ID
   */
  async findBySlotId(slotId: string): Promise<Booking | null> {
    return prisma.booking.findUnique({
      where: { slotId },
    });
  }
}

export const bookingRepository = new BookingRepository();

