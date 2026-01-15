import request from 'supertest';
import app from '../../src/index';
import { createTestHost, createTestUser, createTestSlot, createTestBooking, getFutureDate } from '../helpers';
import { BookingStatus } from '@prisma/client';

describe('Analytics API', () => {
  describe('GET /api/admin/analytics', () => {
    it('should return booking statistics', async () => {
      const host = await createTestHost({ name: 'Test Host' });
      const user = await createTestUser({ name: 'Test Guest' });

      // Create some bookings
      for (let i = 0; i < 3; i++) {
        const slot = await createTestSlot(host.id, {
          startTime: getFutureDate(24 + i * 2),
          endTime: getFutureDate(25 + i * 2),
        });
        await createTestBooking(user.id, slot.id);
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 1);
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 1);

      const response = await request(app)
        .get('/api/admin/analytics')
        .query({
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalBookings).toBe(3);
      expect(response.body.data).toHaveProperty('cancellationRate');
      expect(response.body.data).toHaveProperty('bookingsPerDay');
      expect(response.body.data).toHaveProperty('topHosts');
    });

    it('should calculate cancellation rate correctly', async () => {
      const host = await createTestHost({ name: 'Test Host' });
      const user = await createTestUser({ name: 'Test Guest' });

      // Create 4 bookings, cancel 1
      for (let i = 0; i < 4; i++) {
        const slot = await createTestSlot(host.id, {
          startTime: getFutureDate(24 + i * 2),
          endTime: getFutureDate(25 + i * 2),
        });
        const status = i === 0 ? BookingStatus.CANCELLED : BookingStatus.CONFIRMED;
        await createTestBooking(user.id, slot.id, { status });
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 1);
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 1);

      const response = await request(app)
        .get('/api/admin/analytics')
        .query({
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
        });

      expect(response.status).toBe(200);
      expect(response.body.data.totalBookings).toBe(4);
      expect(response.body.data.cancellationRate).toBe(25); // 1/4 = 25%
    });

    it('should return top hosts', async () => {
      const host1 = await createTestHost({ name: 'Popular Host' });
      const host2 = await createTestHost({ name: 'Less Popular Host' });
      const user = await createTestUser({ name: 'Test Guest' });

      // Create 3 bookings for host1
      for (let i = 0; i < 3; i++) {
        const slot = await createTestSlot(host1.id, {
          startTime: getFutureDate(24 + i * 2),
          endTime: getFutureDate(25 + i * 2),
        });
        await createTestBooking(user.id, slot.id);
      }

      // Create 1 booking for host2
      const slot = await createTestSlot(host2.id, {
        startTime: getFutureDate(100),
        endTime: getFutureDate(101),
      });
      await createTestBooking(user.id, slot.id);

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 1);
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 1);

      const response = await request(app)
        .get('/api/admin/analytics')
        .query({
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
        });

      expect(response.status).toBe(200);
      expect(response.body.data.topHosts.length).toBe(2);
      expect(response.body.data.topHosts[0].hostId).toBe(host1.id);
      expect(response.body.data.topHosts[0].bookingCount).toBe(3);
    });

    it('should require date range parameters', async () => {
      const response = await request(app)
        .get('/api/admin/analytics');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});

