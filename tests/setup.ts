import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Clean up database before all tests
beforeAll(async () => {
  // Connect to database
  await prisma.$connect();
});

// Clean up database after each test
afterEach(async () => {
  // Delete all data in reverse order of dependencies
  await prisma.booking.deleteMany();
  await prisma.slot.deleteMany();
  await prisma.user.deleteMany();
});

// Disconnect after all tests
afterAll(async () => {
  await prisma.$disconnect();
});

export { prisma };

