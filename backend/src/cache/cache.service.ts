import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

/**
 * CacheService provides a unified interface for caching operations
 * Supports Redis for distributed caching and falls back to in-memory cache
 */
@Injectable()
export class CacheService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  /**
   * Get a value from cache
   * @param key - Cache key
   * @returns Cached value or undefined if not found
   */
  async get<T>(key: string): Promise<T | undefined> {
    return await this.cacheManager.get<T>(key);
  }

  /**
   * Set a value in cache
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time to live in seconds (optional, uses default if not provided)
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const options = ttl ? { ttl: ttl * 1000 } : {}; // Convert to milliseconds
    await this.cacheManager.set(key, value, options);
  }

  /**
   * Delete a value from cache
   * @param key - Cache key
   */
  async del(key: string): Promise<void> {
    await this.cacheManager.del(key);
  }

  /**
   * Clear all cache entries
   */
  async reset(): Promise<void> {
    await this.cacheManager.reset();
  }

  /**
   * Get or set a value in cache
   * If the key exists, return the cached value
   * If not, execute the factory function, cache the result, and return it
   * @param key - Cache key
   * @param factory - Function to generate the value if not cached
   * @param ttl - Time to live in seconds (optional)
   */
  async wrap<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, ttl);
    return value;
  }

  /**
   * Delete multiple keys matching a pattern
   * @param pattern - Key pattern (e.g., "user:*")
   */
  async deletePattern(pattern: string): Promise<void> {
    // Note: This is a simplified implementation
    // For production use with Redis, implement proper pattern deletion
    // using SCAN and DEL commands through the Redis client
    console.warn(
      `Pattern deletion for "${pattern}" requires Redis-specific implementation`,
    );
  }

  /**
   * Generate a cache key for user-specific data
   * @param userId - User ID
   * @param resource - Resource identifier
   */
  getUserCacheKey(userId: string, resource: string): string {
    return `user:${userId}:${resource}`;
  }

  /**
   * Generate a cache key for session data
   * @param sessionId - Session ID
   */
  getSessionCacheKey(sessionId: string): string {
    return `session:${sessionId}`;
  }

  /**
   * Generate a cache key for real-time data
   * @param dataType - Type of real-time data
   * @param identifier - Data identifier
   */
  getRealtimeCacheKey(dataType: string, identifier: string): string {
    return `realtime:${dataType}:${identifier}`;
  }
}
