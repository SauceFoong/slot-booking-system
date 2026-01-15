import { PrismaClient, UserRole, SlotStatus, BookingStatus } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Create a test user
 */
export async function createTestUser(data?: {
  email?: string;
  name?: string;
  roles?: UserRole[];
}) {
  return prisma.user.create({
    data: {
      email: data?.email ?? `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
      name: data?.name ?? 'Test User',
      roles: data?.roles ?? [UserRole.GUEST],
    },
  });
}

/**
 * Create a test host (user with HOST role)
 */
export async function createTestHost(data?: {
  email?: string;
  name?: string;
}) {
  return createTestUser({
    ...data,
    roles: [UserRole.HOST, UserRole.GUEST],
  });
}

/**
 * Create a test slot
 */
export async function createTestSlot(hostId: string, data?: {
  startTime?: Date;
  endTime?: Date;
  status?: SlotStatus;
}) {
  const startTime = data?.startTime ?? new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow
  const endTime = data?.endTime ?? new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour later

  return prisma.slot.create({
    data: {
      hostId,
      startTime,
      endTime,
      status: data?.status ?? SlotStatus.AVAILABLE,
    },
  });
}

/**
 * Create a test booking
 */
export async function createTestBooking(userId: string, slotId: string, data?: {
  status?: BookingStatus;
}) {
  // Update slot status to BOOKED
  await prisma.slot.update({
    where: { id: slotId },
    data: { status: SlotStatus.BOOKED },
  });

  return prisma.booking.create({
    data: {
      userId,
      slotId,
      status: data?.status ?? BookingStatus.CONFIRMED,
    },
  });
}

/**
 * Get future date
 */
export function getFutureDate(hoursFromNow: number): Date {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
}

/**
 * Get past date
 */
export function getPastDate(hoursAgo: number): Date {
  return new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
}

export { prisma };

