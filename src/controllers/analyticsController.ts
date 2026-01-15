import { Request, Response } from 'express';
import { analyticsService } from '../services';
import { ApiResponse } from '../types';
import { analyticsFiltersSchema } from '../utils/validation';
import { StatusCodes } from 'http-status-codes';

export class AnalyticsController {
  /**
   * GET /admin/analytics
   * Get booking statistics for a date range
   */
  async getAnalytics(req: Request, res: Response): Promise<void> {
    const filters = analyticsFiltersSchema.parse({
      startDate: req.query.start_date,
      endDate: req.query.end_date,
    });

    const analytics = await analyticsService.getAnalytics(filters);

    const response: ApiResponse = {
      success: true,
      data: analytics,
    };

    res.status(StatusCodes.OK).json(response);
  }
}

export const analyticsController = new AnalyticsController();

