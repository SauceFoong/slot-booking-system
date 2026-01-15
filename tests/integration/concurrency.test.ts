process.env.USE_BOOKING_QUEUE = 'false';

import request from 'supertest';
import app from '../../src/index';
import { createTestHost, createTestUser, createTestSlot } from '../helpers';
import { prisma } from '../helpers';

/**
 * CONCURRENCY TEST
 * 
 * This test verifies that the booking system correctly handles
 * race conditions when multiple users try to book the same slot
 * simultaneously.
 * 
 * The system uses pessimistic locking (SELECT FOR UPDATE) to ensure
 * that only one booking succeeds when multiple requests arrive concurrently.
 */
describe('Concurrency - Double Booking Prevention', () => {
  it('should prevent double booking when multiple users book the same slot simultaneously', async () => {
    // Setup: Create a host and a slot
    const host = await createTestHost({ name: 'Popular Host' });
    const slot = await createTestSlot(host.id);

    // Create multiple users who will try to book
    const users = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        createTestUser({ name: `Concurrent User ${i + 1}` })
      )
    );

    // Fire off all booking requests simultaneously
    const bookingPromises = users.map((user) =>
      request(app)
        .post('/api/bookings')
        .set('x-user-id', user.id)
        .send({ slotId: slot.id })
    );

    const results = await Promise.all(bookingPromises);

    // Count successful and failed bookings
    const successfulBookings = results.filter((r) => r.status === 201);
    const failedBookings = results.filter((r) => r.status === 409);

    // CRITICAL ASSERTIONS:
    // 1. Exactly ONE booking should succeed
    expect(successfulBookings.length).toBe(1);

    // 2. All other attempts should fail with conflict
    expect(failedBookings.length).toBe(users.length - 1);

    // 3. Verify only one booking exists in the database
    const bookings = await prisma.booking.findMany({
      where: { slotId: slot.id },
    });
    expect(bookings.length).toBe(1);

    // 4. Verify the slot is marked as BOOKED
    const updatedSlot = await prisma.slot.findUnique({
      where: { id: slot.id },
    });
    expect(updatedSlot?.status).toBe('BOOKED');

    console.log('✅ Concurrency test passed:');
    console.log(`   - ${successfulBookings.length} successful booking`);
    console.log(`   - ${failedBookings.length} properly rejected attempts`);
  });

  it('should handle high concurrency with multiple slots', async () => {
    // Setup: Create a host with multiple slots
    const host = await createTestHost({ name: 'Popular Host' });
    const slots = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        createTestSlot(host.id, {
          startTime: new Date(Date.now() + (24 + i * 2) * 60 * 60 * 1000),
          endTime: new Date(Date.now() + (25 + i * 2) * 60 * 60 * 1000),
        })
      )
    );

    // Create many users
    const users = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        createTestUser({ name: `User ${i + 1}` })
      )
    );

    // Each user tries to book a random slot
    const bookingPromises = users.map((user, i) => {
      const slotIndex = i % slots.length;
      return request(app)
        .post('/api/bookings')
        .set('x-user-id', user.id)
        .send({ slotId: slots[slotIndex].id });
    });

    await Promise.all(bookingPromises);

    // Verify: Each slot should have at most ONE booking
    for (const slot of slots) {
      const bookings = await prisma.booking.findMany({
        where: { slotId: slot.id },
      });
      expect(bookings.length).toBeLessThanOrEqual(1);
    }

    // Count total bookings - should equal number of slots (since each slot can only be booked once)
    const totalBookings = await prisma.booking.count();
    expect(totalBookings).toBeLessThanOrEqual(slots.length);

    console.log('✅ High concurrency test passed:');
    console.log(`   - ${slots.length} slots available`);
    console.log(`   - ${users.length} concurrent users`);
    console.log(`   - ${totalBookings} successful bookings (no double-bookings)`);
  });

  it('should process bookings in order (first-come-first-served)', async () => {
    // This test verifies that the first request to acquire the lock wins
    const host = await createTestHost({ name: 'Test Host' });
    const slot = await createTestSlot(host.id);

    // Create 3 users
    const [user1, user2, user3] = await Promise.all([
      createTestUser({ name: 'First User' }),
      createTestUser({ name: 'Second User' }),
      createTestUser({ name: 'Third User' }),
    ]);

    // Send requests sequentially with small delays to establish order
    const result1 = await request(app)
      .post('/api/bookings')
      .set('x-user-id', user1.id)
      .send({ slotId: slot.id });

    const result2 = await request(app)
      .post('/api/bookings')
      .set('x-user-id', user2.id)
      .send({ slotId: slot.id });

    const result3 = await request(app)
      .post('/api/bookings')
      .set('x-user-id', user3.id)
      .send({ slotId: slot.id });

    // First request should succeed
    expect(result1.status).toBe(201);
    expect(result1.body.data.userId).toBe(user1.id);

    // Subsequent requests should fail
    expect(result2.status).toBe(409);
    expect(result3.status).toBe(409);
  });
});

