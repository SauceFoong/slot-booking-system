process.env.USE_BOOKING_QUEUE = 'false';

import request from 'supertest';
import app from '../../src/index';
import { createTestHost, createTestUser, createTestSlot, createTestBooking, getFutureDate } from '../helpers';
import { MAX_ACTIVE_BOOKINGS } from '../../src/utils/constants';

describe('Bookings API', () => {
  describe('POST /api/bookings', () => {
    it('should book an available slot', async () => {
      const host = await createTestHost({ name: 'Test Host' });
      const user = await createTestUser({ name: 'Test Guest' });
      const slot = await createTestSlot(host.id);

      const response = await request(app)
        .post('/api/bookings')
        .set('x-user-id', user.id)
        .send({ slotId: slot.id });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.slotId).toBe(slot.id);
      expect(response.body.data.userId).toBe(user.id);
      expect(response.body.data.status).toBe('CONFIRMED');
    });

    it('should not allow booking own slot', async () => {
      const host = await createTestHost({ name: 'Test Host' });
      const slot = await createTestSlot(host.id);

      const response = await request(app)
        .post('/api/bookings')
        .set('x-user-id', host.id)
        .send({ slotId: slot.id });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('own slot');
    });

    it('should not allow booking an already booked slot', async () => {
      const host = await createTestHost({ name: 'Test Host' });
      const user1 = await createTestUser({ name: 'Guest 1' });
      const user2 = await createTestUser({ name: 'Guest 2' });
      const slot = await createTestSlot(host.id);

      // First booking
      await request(app)
        .post('/api/bookings')
        .set('x-user-id', user1.id)
        .send({ slotId: slot.id });

      // Second booking attempt
      const response = await request(app)
        .post('/api/bookings')
        .set('x-user-id', user2.id)
        .send({ slotId: slot.id });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
    });

    it('should enforce max active bookings limit', async () => {
      const host = await createTestHost({ name: 'Test Host' });
      const user = await createTestUser({ name: 'Test Guest' });

      // Create MAX_ACTIVE_BOOKINGS slots and book them
      for (let i = 0; i < MAX_ACTIVE_BOOKINGS; i++) {
        const slot = await createTestSlot(host.id, {
          startTime: getFutureDate(24 + i * 2),
          endTime: getFutureDate(25 + i * 2),
        });
        await createTestBooking(user.id, slot.id);
      }

      // Try to book one more
      const extraSlot = await createTestSlot(host.id, {
        startTime: getFutureDate(100),
        endTime: getFutureDate(101),
      });

      const response = await request(app)
        .post('/api/bookings')
        .set('x-user-id', user.id)
        .send({ slotId: extraSlot.id });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('maximum');
    });
  });

  describe('GET /api/bookings', () => {
    it('should return user bookings', async () => {
      const host = await createTestHost({ name: 'Test Host' });
      const user = await createTestUser({ name: 'Test Guest' });
      const slot = await createTestSlot(host.id);
      await createTestBooking(user.id, slot.id);

      const response = await request(app)
        .get('/api/bookings')
        .set('x-user-id', user.id);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].userId).toBe(user.id);
    });
  });

  describe('DELETE /api/bookings/:id', () => {
    it('should cancel a booking more than 1 hour before', async () => {
      const host = await createTestHost({ name: 'Test Host' });
      const user = await createTestUser({ name: 'Test Guest' });
      const slot = await createTestSlot(host.id, {
        startTime: getFutureDate(24), // 24 hours from now
        endTime: getFutureDate(25),
      });
      const booking = await createTestBooking(user.id, slot.id);

      const response = await request(app)
        .delete(`/api/bookings/${booking.id}`)
        .set('x-user-id', user.id);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('CANCELLED');
    });

    it('should not cancel a booking within 1 hour of start', async () => {
      const host = await createTestHost({ name: 'Test Host' });
      const user = await createTestUser({ name: 'Test Guest' });
      const slot = await createTestSlot(host.id, {
        startTime: getFutureDate(0.5), // 30 minutes from now
        endTime: getFutureDate(1.5),
      });
      const booking = await createTestBooking(user.id, slot.id);

      const response = await request(app)
        .delete(`/api/bookings/${booking.id}`)
        .set('x-user-id', user.id);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('1 hour');
    });

    it('should not allow cancelling another user\'s booking', async () => {
      const host = await createTestHost({ name: 'Test Host' });
      const user1 = await createTestUser({ name: 'Guest 1' });
      const user2 = await createTestUser({ name: 'Guest 2' });
      const slot = await createTestSlot(host.id);
      const booking = await createTestBooking(user1.id, slot.id);

      const response = await request(app)
        .delete(`/api/bookings/${booking.id}`)
        .set('x-user-id', user2.id);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });
});

