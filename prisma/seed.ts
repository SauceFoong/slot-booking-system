import { PrismaClient, UserRole, SlotStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create sample users
  const host1 = await prisma.user.upsert({
    where: { email: 'host1@example.com' },
    update: {},
    create: {
      email: 'host1@example.com',
      name: 'Alice Host',
      roles: [UserRole.HOST, UserRole.GUEST],
    },
  });

  const host2 = await prisma.user.upsert({
    where: { email: 'host2@example.com' },
    update: {},
    create: {
      email: 'host2@example.com',
      name: 'Bob Host',
      roles: [UserRole.HOST],
    },
  });

  const guest1 = await prisma.user.upsert({
    where: { email: 'guest1@example.com' },
    update: {},
    create: {
      email: 'guest1@example.com',
      name: 'Charlie Guest',
      roles: [UserRole.GUEST],
    },
  });

  const guest2 = await prisma.user.upsert({
    where: { email: 'guest2@example.com' },
    update: {},
    create: {
      email: 'guest2@example.com',
      name: 'Diana Guest',
      roles: [UserRole.GUEST],
    },
  });

  console.log('✅ Created users:', { host1: host1.id, host2: host2.id, guest1: guest1.id, guest2: guest2.id });

  // Create sample slots for host1 (next 7 days)
  const now = new Date();
  const slots = [];

  for (let day = 1; day <= 7; day++) {
    const date = new Date(now);
    date.setDate(date.getDate() + day);
    
    // Morning slot: 9:00 - 10:00
    const morningStart = new Date(date);
    morningStart.setHours(9, 0, 0, 0);
    const morningEnd = new Date(date);
    morningEnd.setHours(10, 0, 0, 0);

    // Afternoon slot: 14:00 - 15:00
    const afternoonStart = new Date(date);
    afternoonStart.setHours(14, 0, 0, 0);
    const afternoonEnd = new Date(date);
    afternoonEnd.setHours(15, 0, 0, 0);

    slots.push({
      hostId: host1.id,
      startTime: morningStart,
      endTime: morningEnd,
      status: SlotStatus.AVAILABLE,
    });

    slots.push({
      hostId: host1.id,
      startTime: afternoonStart,
      endTime: afternoonEnd,
      status: SlotStatus.AVAILABLE,
    });
  }

  // Create slots for host2 (next 5 days)
  for (let day = 1; day <= 5; day++) {
    const date = new Date(now);
    date.setDate(date.getDate() + day);
    
    // Evening slot: 18:00 - 19:00
    const eveningStart = new Date(date);
    eveningStart.setHours(18, 0, 0, 0);
    const eveningEnd = new Date(date);
    eveningEnd.setHours(19, 0, 0, 0);

    slots.push({
      hostId: host2.id,
      startTime: eveningStart,
      endTime: eveningEnd,
      status: SlotStatus.AVAILABLE,
    });
  }

  // Add a past slot for host2 (Jan 1, 2026 10:00-11:00) for testing
  const pastSlotStart = new Date('2026-01-01T10:00:00Z');
  const pastSlotEnd = new Date('2026-01-01T11:00:00Z');
  slots.push({
    hostId: host2.id,
    startTime: pastSlotStart,
    endTime: pastSlotEnd,
    status: SlotStatus.AVAILABLE,
  });

  // Insert slots
  for (const slot of slots) {
    await prisma.slot.create({ data: slot });
  }

  console.log(`✅ Created ${slots.length} slots`);

  console.log('🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

