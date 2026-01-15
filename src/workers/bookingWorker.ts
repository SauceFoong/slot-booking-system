import { Worker, Job } from 'bullmq';
import { bookingService } from '../services';
import { AppError } from '../types';
import { BookingJobData, BookingJobResult } from '../queues';

// Redis connection config for worker
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const url = new URL(redisUrl);
const connection = {
  host: url.hostname,
  port: parseInt(url.port) || 6379,
  password: url.password || undefined,
  maxRetriesPerRequest: null,
};

// Process booking jobs
async function processBookingJob(job: Job<BookingJobData>): Promise<BookingJobResult> {
  const { userId, slotId } = job.data;

  try {
    const booking = await bookingService.createBooking(userId, slotId);
    return {
      success: true,
      data: booking,
    };
  } catch (error) {
    if (error instanceof AppError) {
      return {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          statusCode: error.statusCode,
        },
      };
    }

    // Unknown error
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
        statusCode: 500,
      },
    };
  }
}

// Create the worker
let worker: Worker<BookingJobData, BookingJobResult> | null = null;

export function startBookingWorker(): Worker<BookingJobData, BookingJobResult> {
  if (worker) {
    return worker;
  }

  worker = new Worker<BookingJobData, BookingJobResult>(
    'booking',
    processBookingJob,
    {
      connection,
      concurrency: 1, // Process one job at a time for strict FCFS
    }
  );

  worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} completed for slot ${job.data.slotId}`);
  });

  worker.on('failed', (job, error) => {
    console.error(`[Worker] Job ${job?.id} failed:`, error.message);
  });

  console.log('[Worker] Booking worker started');
  return worker;
}

export async function stopBookingWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    console.log('[Worker] Booking worker stopped');
  }
}

