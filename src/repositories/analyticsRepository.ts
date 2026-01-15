import prisma from '../utils/prisma';
import { AnalyticsResponse } from '../types';

export class AnalyticsRepository {
  /**
   * Get booking analytics for a date range
   * Optimized for performance with 50K+ bookings
   */
  async getAnalytics(startDate: Date, endDate: Date): Promise<AnalyticsResponse> {
    // Run all queries in parallel for efficiency
    const [
      totalBookings,
      cancelledBookings,
      bookingsPerDay,
      topHosts,
    ] = await Promise.all([
      // Total bookings in date range
      prisma.booking.count({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),

      // Cancelled bookings for cancellation rate
      prisma.booking.count({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
          status: 'CANCELLED',
        },
      }),

      // Bookings per day using raw SQL for efficiency
      prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
        SELECT 
          DATE("createdAt") as date,
          COUNT(*) as count
        FROM "Booking"
        WHERE "createdAt" >= ${startDate}
          AND "createdAt" <= ${endDate}
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `,

      // Top 5 busiest hosts
      prisma.$queryRaw<Array<{ hostId: string; hostName: string; bookingCount: bigint }>>`
        SELECT 
          s."hostId" as "hostId",
          u.name as "hostName",
          COUNT(b.id) as "bookingCount"
        FROM "Booking" b
        INNER JOIN "Slot" s ON b."slotId" = s.id
        INNER JOIN "User" u ON s."hostId" = u.id
        WHERE b."createdAt" >= ${startDate}
          AND b."createdAt" <= ${endDate}
          AND b.status = 'CONFIRMED'
        GROUP BY s."hostId", u.name
        ORDER BY "bookingCount" DESC
        LIMIT 5
      `,
    ]);

    // Calculate cancellation rate
    const cancellationRate = totalBookings > 0
      ? (cancelledBookings / totalBookings) * 100
      : 0;

    return {
      totalBookings,
      cancellationRate: Math.round(cancellationRate * 100) / 100, // Round to 2 decimal places
      bookingsPerDay: bookingsPerDay.map((row) => ({
        date: row.date,
        count: Number(row.count),
      })),
      topHosts: topHosts.map((row) => ({
        hostId: row.hostId,
        hostName: row.hostName,
        bookingCount: Number(row.bookingCount),
      })),
    };
  }
}

export const analyticsRepository = new AnalyticsRepository();

