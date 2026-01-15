import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Slot Booking System API',
      version: '1.0.0',
      description: `
## Overview

A production-ready REST API for managing time slot bookings. Hosts can create available time slots, 
and users can browse and book these slots.

## Key Features

- **Slot Management**: Hosts create, view, and manage available time slots
- **Booking System**: Users browse and book available slots with concurrency protection
- **Analytics**: Administrators can view booking statistics

## Authentication

This API uses a simplified header-based authentication for testing purposes.
Include the \`x-user-id\` header with a valid user UUID in all authenticated requests.

## Testing Tips

1. **Create a user first** using \`POST /api/users\` to get a user ID
2. **Copy the user ID** from the response
3. **Set the x-user-id header** by clicking "Authorize" button above
4. **Test the endpoints** - the header will be automatically included

## Business Rules

- Users cannot book their own slots
- Maximum 5 active bookings per user
- Cancellation only allowed >1 hour before slot start time
- Slots cannot overlap for the same host
      `,
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: '/api',
        description: 'API Server',
      },
    ],
    components: {
      securitySchemes: {
        UserIdHeader: {
          type: 'apiKey',
          in: 'header',
          name: 'x-user-id',
          description: 'User ID (UUID) for authentication. Create a user first, then use their ID here.',
        },
      },
      schemas: {
        // User Schemas
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' },
            email: { type: 'string', format: 'email', example: 'user@example.com' },
            name: { type: 'string', example: 'John Doe' },
            roles: { 
              type: 'array', 
              items: { type: 'string', enum: ['HOST', 'GUEST'] },
              example: ['GUEST']
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        CreateUserRequest: {
          type: 'object',
          required: ['email', 'name'],
          properties: {
            email: { type: 'string', format: 'email', example: 'newuser@example.com' },
            name: { type: 'string', example: 'Jane Smith' },
            roles: { 
              type: 'array', 
              items: { type: 'string', enum: ['HOST', 'GUEST'] },
              default: ['GUEST'],
              description: 'User roles. Use ["HOST", "GUEST"] if the user should be able to create slots.'
            },
          },
        },

        // Slot Schemas
        Slot: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            hostId: { type: 'string', format: 'uuid' },
            hostName: { type: 'string', example: 'Alice Host' },
            startTime: { type: 'string', format: 'date-time' },
            endTime: { type: 'string', format: 'date-time' },
            status: { type: 'string', enum: ['AVAILABLE', 'BOOKED', 'CANCELLED'] },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        CreateSlotRequest: {
          type: 'object',
          required: ['startTime', 'endTime'],
          properties: {
            startTime: { 
              type: 'string', 
              format: 'date-time',
              description: 'Start time (must be in the future)',
              example: '2026-02-01T10:00:00Z'
            },
            endTime: { 
              type: 'string', 
              format: 'date-time',
              description: 'End time (must be after start time)',
              example: '2026-02-01T11:00:00Z'
            },
          },
        },

        // Booking Schemas
        Booking: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            slotId: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            status: { type: 'string', enum: ['CONFIRMED', 'CANCELLED'] },
            slot: { $ref: '#/components/schemas/Slot' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        CreateBookingRequest: {
          type: 'object',
          required: ['slotId'],
          properties: {
            slotId: { 
              type: 'string', 
              format: 'uuid',
              description: 'ID of the slot to book',
              example: '550e8400-e29b-41d4-a716-446655440000'
            },
          },
        },

        // Analytics Schema
        Analytics: {
          type: 'object',
          properties: {
            totalBookings: { type: 'integer', example: 150 },
            cancellationRate: { type: 'number', format: 'float', example: 12.5 },
            bookingsPerDay: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  date: { type: 'string', example: '2026-01-15' },
                  count: { type: 'integer', example: 25 },
                },
              },
            },
            topHosts: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  hostId: { type: 'string', format: 'uuid' },
                  hostName: { type: 'string', example: 'Popular Host' },
                  bookingCount: { type: 'integer', example: 45 },
                },
              },
            },
          },
        },

        // Response Schemas
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'object' },
            meta: {
              type: 'object',
              properties: {
                page: { type: 'integer' },
                limit: { type: 'integer' },
                total: { type: 'integer' },
              },
            },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'NOT_FOUND' },
                message: { type: 'string', example: 'Resource not found' },
                details: { type: 'object', nullable: true },
              },
            },
          },
        },
      },
    },
    tags: [
      {
        name: 'Health',
        description: 'API health check endpoints',
      },
      {
        name: 'Users',
        description: 'User management endpoints. Create users to get user IDs for testing.',
      },
      {
        name: 'Slots',
        description: 'Time slot management. Hosts can create slots, all users can view available slots.',
      },
      {
        name: 'Bookings',
        description: 'Booking management. Users can book available slots and manage their bookings.',
      },
      {
        name: 'Analytics',
        description: 'Administrator analytics and statistics.',
      },
    ],
  },
  apis: ['./src/routes/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);

