import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { typeOrmConfig } from '../config/typeorm.config';
import { ConnectionPoolMonitorService } from './connection-pool-monitor.service';

/**
 * Database Module with Connection Pooling (#418)
 * 
 * Features:
 * - Optimized connection pool configuration
 * - Connection leak detection
 * - Pool health monitoring
 * - High concurrency support
 */
@Module({
  imports: [
    TypeOrmModule.forRoot(typeOrmConfig),
    ScheduleModule.forRoot(),
  ],
  providers: [ConnectionPoolMonitorService],
  exports: [ConnectionPoolMonitorService],
})
export class DatabaseModule {}
