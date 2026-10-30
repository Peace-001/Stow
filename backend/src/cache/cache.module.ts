import { Module } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-yet';
import { CacheService } from './cache.service';

@Module({
  imports: [
    NestCacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const redisHost = configService.get<string>('REDIS_HOST', 'localhost');
        const redisPort = configService.get<number>('REDIS_PORT', 6379);
        const redisPassword = configService.get<string>('REDIS_PASSWORD');
        const redisTtl = configService.get<number>('REDIS_TTL', 3600); // 1 hour default

        // If Redis is configured, use Redis store
        if (redisHost) {
          try {
            return {
              store: await redisStore({
                socket: {
                  host: redisHost,
                  port: redisPort,
                },
                password: redisPassword,
                ttl: redisTtl * 1000, // Convert to milliseconds
              }),
              ttl: redisTtl * 1000,
            };
          } catch (error) {
            console.warn('Redis connection failed, falling back to memory cache:', error);
            // Fall back to in-memory cache if Redis fails
            return {
              ttl: redisTtl * 1000,
            };
          }
        }

        // Default to in-memory cache
        return {
          ttl: redisTtl * 1000,
        };
      },
      isGlobal: true,
    }),
  ],
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
