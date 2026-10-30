# Cache Layer with Redis

This module implements a comprehensive caching layer using Redis for distributed caching with automatic fallback to in-memory caching.

## Features

- **Redis Integration**: Distributed caching using Redis for production environments
- **Automatic Fallback**: Falls back to in-memory cache if Redis is unavailable
- **Session Storage**: Efficient session management with configurable TTL
- **Real-time Data Caching**: Optimized caching for frequently accessed real-time data
- **Decorator Support**: Easy-to-use decorators for automatic response caching
- **Type-safe**: Full TypeScript support with generics

## Installation

Install the required Redis dependencies:

```bash
pnpm add cache-manager-redis-yet
```

## Configuration

Add the following environment variables to your `.env` file:

```env
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
REDIS_TTL=3600  # Default TTL in seconds (1 hour)
```

## Usage

### 1. Import the CacheModule

The CacheModule is configured globally in `app.module.ts`:

```typescript
import { CacheModule } from './cache/cache.module';

@Module({
  imports: [
    CacheModule,
    // ... other modules
  ],
})
export class AppModule {}
```

### 2. Using CacheService

Inject the `CacheService` into your services:

```typescript
import { Injectable } from '@nestjs/common';
import { CacheService } from './cache/cache.service';

@Injectable()
export class UserService {
  constructor(private readonly cacheService: CacheService) {}

  async getUserProfile(userId: string) {
    const cacheKey = this.cacheService.getUserCacheKey(userId, 'profile');
    
    // Try to get from cache
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    // If not cached, fetch from database
    const profile = await this.fetchFromDatabase(userId);
    
    // Cache the result for 30 minutes
    await this.cacheService.set(cacheKey, profile, 1800);
    
    return profile;
  }

  // Or use the wrap method for simpler code
  async getUserProfileSimple(userId: string) {
    const cacheKey = this.cacheService.getUserCacheKey(userId, 'profile');
    
    return this.cacheService.wrap(
      cacheKey,
      () => this.fetchFromDatabase(userId),
      1800, // 30 minutes TTL
    );
  }
}
```

### 3. Using Decorators for Automatic Caching

Apply the `@CacheKey` and `@CacheTTL` decorators to controller methods:

```typescript
import { Controller, Get, Param, UseInterceptors } from '@nestjs/common';
import { HttpCacheInterceptor } from './cache/interceptors/cache.interceptor';
import { CacheKey, CacheTTL } from './cache/decorators/cache-key.decorator';

@Controller('users')
@UseInterceptors(HttpCacheInterceptor)
export class UsersController {
  @Get(':id/profile')
  @CacheKey('user:profile::id')
  @CacheTTL(1800) // 30 minutes
  async getUserProfile(@Param('id') id: string) {
    // This response will be automatically cached
    return this.usersService.getProfile(id);
  }
}
```

### 4. Session Storage

Store and retrieve session data:

```typescript
// Store session
const sessionKey = this.cacheService.getSessionCacheKey(sessionId);
await this.cacheService.set(sessionKey, sessionData, 86400); // 24 hours

// Retrieve session
const session = await this.cacheService.get(sessionKey);

// Delete session
await this.cacheService.del(sessionKey);
```

### 5. Real-time Data Caching

Cache frequently accessed real-time data:

```typescript
// Cache account balance
const balanceKey = this.cacheService.getRealtimeCacheKey('balance', accountId);
await this.cacheService.set(balanceKey, balance, 60); // 1 minute

// Cache transaction data
const txKey = this.cacheService.getRealtimeCacheKey('transaction', txHash);
await this.cacheService.set(txKey, transaction, 300); // 5 minutes
```

## Cache Key Patterns

The module provides standardized cache key patterns:

- **User Data**: `user:{userId}:{resource}`
- **Sessions**: `session:{sessionId}`
- **Real-time Data**: `realtime:{dataType}:{identifier}`

## Best Practices

1. **Set Appropriate TTL**: Choose TTL based on data volatility
   - Static data: 1 hour or more
   - User profiles: 15-30 minutes
   - Real-time data: 1-5 minutes
   - Session data: 24 hours

2. **Cache Invalidation**: Always invalidate cache when data changes
   ```typescript
   await this.cacheService.del(cacheKey);
   ```

3. **Error Handling**: The module automatically falls back to in-memory cache if Redis fails

4. **Key Naming**: Use descriptive, hierarchical keys for better organization

## Performance Benefits

- **Reduced Database Load**: Frequently accessed data is served from cache
- **Faster Response Times**: Redis provides sub-millisecond latency
- **Scalability**: Distributed caching across multiple application instances
- **Session Management**: Efficient session storage without database queries

## Monitoring

Monitor cache effectiveness:

- Cache hit/miss ratio
- Average response time improvement
- Redis memory usage
- Cache key expiration patterns

## Production Considerations

1. **Redis High Availability**: Use Redis Cluster or Sentinel for production
2. **Memory Management**: Set appropriate maxmemory and eviction policies
3. **Connection Pooling**: Configure connection pool size based on load
4. **Monitoring**: Set up Redis monitoring and alerts
5. **Backup Strategy**: Implement Redis persistence (RDB/AOF) if needed

## Related

- [Performance Tests](../performance/cache-effectiveness-test.js)
- [Redis Configuration](https://redis.io/docs/management/config/)
- [NestJS Caching](https://docs.nestjs.com/techniques/caching)
