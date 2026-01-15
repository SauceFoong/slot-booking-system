import { analyticsRepository } from '../repositories';
import { AnalyticsFilters, AnalyticsResponse } from '../types';

export class AnalyticsService {
  /**
   * Get booking analytics for a date range
   */
  async getAnalytics(filters: AnalyticsFilters): Promise<AnalyticsResponse> {
    const { startDate, endDate } = filters;

    // Set time to start of day for startDate and end of day for endDate
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    return analyticsRepository.getAnalytics(start, end);
  }
}

export const analyticsService = new AnalyticsService();

