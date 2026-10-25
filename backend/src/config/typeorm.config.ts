import { config } from 'dotenv';
config();

import { DataSource, DataSourceOptions } from 'typeorm';
import { join } from 'path';

export const typeOrmConfig: DataSourceOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [join(__dirname, '/../**/*.entity{.ts,.js}')],
  migrations: [join(__dirname, '/../migrations/*{.ts,.js}')],
  synchronize: false, // Never use synchronize in production
  logging: process.env.NODE_ENV === 'development',
  migrationsRun: false, // Run migrations manually
  
  // Connection Pool Configuration (#418)
  extra: {
    // Maximum number of connections in the pool
    max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    
    // Minimum number of connections to maintain in the pool
    min: parseInt(process.env.DB_POOL_MIN || '5', 10),
    
    // Maximum time (ms) a connection can be idle before being released
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT_MS || '30000', 10),
    
    // Maximum time (ms) to wait for a connection from the pool
    connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT_MS || '10000', 10),
    
    // Maximum lifetime (ms) of a connection before it's retired
    maxLifetimeSeconds: parseInt(process.env.DB_POOL_MAX_LIFETIME_SECONDS || '1800', 10),
    
    // Enable connection leak detection
    // Log warning if connection is held longer than this duration (ms)
    leakDetectionThreshold: parseInt(process.env.DB_POOL_LEAK_DETECTION_MS || '60000', 10),
    
    // Enable statement timeout to prevent long-running queries
    statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT_MS || '30000', 10),
    
    // Application name for connection tracking in PostgreSQL
    application_name: process.env.DB_APPLICATION_NAME || 'stow-backend',
    
    // Keep alive settings to maintain healthy connections
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  },
  
  // Connection pool size (alternative to extra.max for TypeORM)
  poolSize: parseInt(process.env.DB_POOL_MAX || '20', 10),
  
  // Enable connection pooling error handling
  maxQueryExecutionTime: parseInt(process.env.DB_MAX_QUERY_EXECUTION_TIME_MS || '5000', 10),
};

// DataSource instance for TypeORM CLI
const dataSource = new DataSource(typeOrmConfig);

export default dataSource;
