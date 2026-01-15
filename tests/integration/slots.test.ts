import request from 'supertest';
import app from '../../src/index';
import { createTestHost, createTestUser, createTestSlot, getFutureDate } from '../helpers';
import { SlotStatus } from '@prisma/client';

describe('Slots API', () => {
  describe('POST /api/slots', () => {
    it('should create a slot for a host', async () => {
      const host = await createTestHost({ name: 'Test Host' });
      const startTime = getFutureDate(24);
      const endTime = getFutureDate(25);

      const response = await request(app)
        .post('/api/slots')
        .set('x-user-id', host.id)
        .send({
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.hostId).toBe(host.id);
      expect(response.body.data.status).toBe('AVAILABLE');
    });

    it('should reject slot creation for non-hosts', async () => {
      const user = await createTestUser({ name: 'Guest User' });
      const startTime = getFutureDate(24);
      const endTime = getFutureDate(25);

      const response = await request(app)
        .post('/api/slots')
        .set('x-user-id', user.id)
        .send({
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should reject overlapping slots for the same host', async () => {
      const host = await createTestHost({ name: 'Test Host' });
      const startTime = getFutureDate(24);
      const endTime = getFutureDate(25);

      // Create first slot
      await createTestSlot(host.id, { startTime, endTime });

      // Try to create overlapping slot
      const response = await request(app)
        .post('/api/slots')
        .set('x-user-id', host.id)
        .send({
          startTime: new Date(startTime.getTime() + 30 * 60 * 1000).toISOString(), // 30 min later
          endTime: new Date(endTime.getTime() + 30 * 60 * 1000).toISOString(),
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
    });

    it('should reject slots in the past', async () => {
      const host = await createTestHost({ name: 'Test Host' });
      const startTime = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
      const endTime = new Date(Date.now()); // Now

      const response = await request(app)
        .post('/api/slots')
        .set('x-user-id', host.id)
        .send({
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/slots', () => {
    it('should return available slots', async () => {
      const host = await createTestHost({ name: 'Test Host' });
      await createTestSlot(host.id, {
        startTime: getFutureDate(24),
        endTime: getFutureDate(25),
      });

      const user = await createTestUser();
      const response = await request(app)
        .get('/api/slots')
        .set('x-user-id', user.id);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0].status).toBe('AVAILABLE');
    });

    it('should filter slots by host', async () => {
      const host1 = await createTestHost({ name: 'Host 1' });
      const host2 = await createTestHost({ name: 'Host 2' });
      
      await createTestSlot(host1.id, { startTime: getFutureDate(24), endTime: getFutureDate(25) });
      await createTestSlot(host2.id, { startTime: getFutureDate(26), endTime: getFutureDate(27) });

      const user = await createTestUser();
      const response = await request(app)
        .get(`/api/slots?hostId=${host1.id}`)
        .set('x-user-id', user.id);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].hostId).toBe(host1.id);
    });
  });

  describe('DELETE /api/slots/:id', () => {
    it('should delete an unbooked slot', async () => {
      const host = await createTestHost({ name: 'Test Host' });
      const slot = await createTestSlot(host.id);

      const response = await request(app)
        .delete(`/api/slots/${slot.id}`)
        .set('x-user-id', host.id);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should not delete a booked slot', async () => {
      const host = await createTestHost({ name: 'Test Host' });
      const slot = await createTestSlot(host.id, { status: SlotStatus.BOOKED });

      const response = await request(app)
        .delete(`/api/slots/${slot.id}`)
        .set('x-user-id', host.id);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
    });

    it('should not allow non-owners to delete slots', async () => {
      const host = await createTestHost({ name: 'Test Host' });
      const otherHost = await createTestHost({ name: 'Other Host' });
      const slot = await createTestSlot(host.id);

      const response = await request(app)
        .delete(`/api/slots/${slot.id}`)
        .set('x-user-id', otherHost.id);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });
});

