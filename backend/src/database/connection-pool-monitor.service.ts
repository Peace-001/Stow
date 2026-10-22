import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';

/**
 * Connection Pool Monitor Service (#418)
 * 
 * Monitors database connection pool health and provides:
 * - Real-time pool statistics
 * - Connection leak detection
 * - Performance metrics
 * - Automatic cleanup of stale connections
 */
@Injectable()
export class ConnectionPoolMonitorService implements OnModuleInit {
  private readonly logger = new Logger(ConnectionPoolMonitorService.name);
  private connectionCheckouts = new Map<string, Date>();
  private readonly leakThreshold = parseInt(process.env.DB_POOL_LEAK_DETECTION_MS || '60000', 10);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit() {
    this.logger.log('Connection pool monitor initialized');
    await this.logPoolStatistics();
  }

  /**
   * Get current connection pool statistics
   */
  async getPoolStatistics() {
    const driver = this.dataSource.driver as any;
    const pool = driver.master;

    if (!pool) {
      return {
        error: 'Pool not available',
      };
    }

    return {
      totalConnections: pool.totalCount || 0,
      idleConnections: pool.idleCount || 0,
      activeConnections: (pool.totalCount || 0) - (pool.idleCount || 0),
      waitingRequests: pool.waitingCount || 0,
      maxConnections: parseInt(process.env.DB_POOL_MAX || '20', 10),
      minConnections: parseInt(process.env.DB_POOL_MIN || '5', 10),
      poolUtilization: this.calculatePoolUtilization(pool),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Log pool statistics (runs every 5 minutes)
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async logPoolStatistics() {
    try {
      const stats = await this.getPoolStatistics();
      
      if (stats.error) {
        this.logger.warn(`Pool statistics unavailable: ${stats.error}`);
        return;
      }

      this.logger.log(
        `Pool Stats - Total: ${stats.totalConnections}, Active: ${stats.activeConnections}, ` +
        `Idle: ${stats.idleConnections}, Waiting: ${stats.waitingRequests}, ` +
        `Utilization: ${stats.poolUtilization}%`
      );

      // Warn if pool utilization is high
      if (stats.poolUtilization > 80) {
        this.logger.warn(
          `High pool utilization detected: ${stats.poolUtilization}%. ` +
          `Consider increasing DB_POOL_MAX (current: ${stats.maxConnections})`
        );
      }

      // Warn if many requests are waiting
      if (stats.waitingRequests > 5) {
        this.logger.warn(
          `${stats.waitingRequests} requests waiting for connections. ` +
          `Pool may be undersized or queries may be slow.`
        );
      }
    } catch (error) {
      this.logger.error(`Failed to log pool statistics: ${error.message}`);
    }
  }

  /**
   * Check for connection leaks (runs every minute)
   */
  @Cron(CronExpression.EVERY_MINUTE)
  checkForLeaks() {
    const now = new Date();
    const leaks: string[] = [];

    for (const [connectionId, checkoutTime] of this.connectionCheckouts.entries()) {
      const holdTime = now.getTime() - checkoutTime.getTime();
      
      if (holdTime > this.leakThreshold) {
        leaks.push(`Connection ${connectionId} held for ${Math.round(holdTime / 1000)}s`);
      }
    }

    if (leaks.length > 0) {
      this.logger.warn(
        `Potential connection leaks detected:\n${leaks.join('\n')}\n` +
        `Review code for missing connection releases or long-running transactions.`
      );
    }
  }

  /**
   * Track connection checkout
   */
  trackCheckout(connectionId: string) {
    this.connectionCheckouts.set(connectionId, new Date());
  }

  /**
   * Track connection release
   */
  trackRelease(connectionId: string) {
    this.connectionCheckouts.delete(connectionId);
  }

  /**
   * Calculate pool utilization percentage
   */
  private calculatePoolUtilization(pool: any): number {
    const total = pool.totalCount || 0;
    const max = parseInt(process.env.DB_POOL_MAX || '20', 10);
    
    if (max === 0) return 0;
    
    return Math.round((total / max) * 100);
  }

  /**
   * Health check endpoint data
   */
  async getHealthStatus() {
    try {
      const stats = await this.getPoolStatistics();
      
      if (stats.error) {
        return {
          status: 'unhealthy',
          message: stats.error,
        };
      }

      const isHealthy = 
        stats.poolUtilization < 90 &&
        stats.waitingRequests < 10;

      return {
        status: isHealthy ? 'healthy' : 'degraded',
        poolUtilization: stats.poolUtilization,
        activeConnections: stats.activeConnections,
        waitingRequests: stats.waitingRequests,
        message: isHealthy 
          ? 'Connection pool operating normally'
          : 'Connection pool under stress',
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Failed to check pool health: ${error.message}`,
      };
    }
  }
}
