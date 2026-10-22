import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as compression from 'compression';

/**
 * Compression Middleware
 * 
 * Provides response compression using Gzip/Brotli algorithms
 * Features:
 * - Automatic algorithm selection based on Accept-Encoding header
 * - Configurable size threshold
 * - Content-type filtering
 * - Performance optimization for API responses
 */
@Injectable()
export class CompressionMiddleware implements NestMiddleware {
  private compressionHandler: ReturnType<typeof compression>;

  constructor() {
    this.compressionHandler = compression({
      // Only compress responses above 1KB threshold
      threshold: 1024,

      // Compression level (0-9, where 6 is default balance between speed and size)
      level: 6,

      // Filter function to determine which responses should be compressed
      filter: (req: Request, res: Response) => {
        // Don't compress if client explicitly requests no compression
        if (req.headers['x-no-compression']) {
          return false;
        }

        // Check if response should be compressed based on content-type
        const contentType = res.getHeader('Content-Type');
        if (typeof contentType === 'string') {
          return this.shouldCompress(contentType);
        }

        // Use compression's default filter function
        return compression.filter(req, res);
      },

      // Memory level (1-9, affects memory usage vs speed tradeoff)
      memLevel: 8,

      // Brotli quality (0-11, higher = better compression but slower)
      brotliOptions: {
        params: {
          [require('zlib').constants.BROTLI_PARAM_QUALITY]: 4,
          [require('zlib').constants.BROTLI_PARAM_SIZE_HINT]: 0,
        },
      },
    });
  }

  /**
   * Determines if a content-type should be compressed
   * @param contentType - The response content-type header
   * @returns true if content should be compressed
   */
  private shouldCompress(contentType: string): boolean {
    // List of compressible content types
    const compressibleTypes = [
      'text/html',
      'text/css',
      'text/plain',
      'text/xml',
      'text/javascript',
      'application/javascript',
      'application/json',
      'application/xml',
      'application/ld+json',
      'application/graphql+json',
      'application/x-javascript',
      'application/vnd.api+json',
      'image/svg+xml',
      'image/x-icon',
      'font/ttf',
      'font/otf',
      'font/woff',
      'font/woff2',
    ];

    // Check if content-type matches any compressible types
    return compressibleTypes.some((type) =>
      contentType.toLowerCase().includes(type.toLowerCase()),
    );
  }

  /**
   * Middleware handler
   */
  use(req: Request, res: Response, next: NextFunction): void {
    this.compressionHandler(req, res, next);
  }
}
