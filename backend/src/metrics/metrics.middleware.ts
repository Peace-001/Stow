import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly metricsService: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    if (req.path === '/api/v1/metrics') {
      next();
      return;
    }

    this.metricsService.activeConnections.inc();
    const end = this.metricsService.httpRequestDuration.startTimer();

    res.on('finish', () => {
      const route = req.route?.path ?? req.path;
      const labels = {
        method: req.method,
        route,
        status_code: String(res.statusCode),
      };

      end(labels);
      this.metricsService.httpRequestsTotal.inc(labels);
      this.metricsService.activeConnections.dec();
    });

    next();
  }
}
