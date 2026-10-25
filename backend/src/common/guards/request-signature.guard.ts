import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Decorator to mark routes as requiring HMAC signature validation
 */
export const RequireSignature = () => {
  return (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    if (descriptor) {
      Reflect.defineMetadata('requireSignature', true, descriptor.value);
    } else {
      Reflect.defineMetadata('requireSignature', true, target);
    }
  };
};

/**
 * Guard to validate HMAC-SHA256 request signatures
 * Protects against tampering and replay attacks
 */
@Injectable()
export class RequestSignatureGuard implements CanActivate {
  private readonly logger = new Logger(RequestSignatureGuard.name);
  private readonly signatureSecret: string;
  private readonly timestampToleranceMs: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
  ) {
    this.signatureSecret = this.configService.get<string>(
      'REQUEST_SIGNATURE_SECRET',
    );
    this.timestampToleranceMs =
      this.configService.get<number>('REQUEST_SIGNATURE_TOLERANCE_MS') ||
      300000; // Default: 5 minutes

    if (!this.signatureSecret) {
      this.logger.warn(
        'REQUEST_SIGNATURE_SECRET not configured. Request signature validation disabled.',
      );
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if signature is required for this route
    const requireSignature = this.reflector.get<boolean>(
      'requireSignature',
      context.getHandler(),
    );

    if (!requireSignature) {
      return true; // Signature not required for this route
    }

    if (!this.signatureSecret) {
      this.logger.error(
        'Signature required but REQUEST_SIGNATURE_SECRET not configured',
      );
      throw new UnauthorizedException(
        'Request signature validation not configured',
      );
    }

    const request = context.switchToHttp().getRequest();
    const signature = request.headers['x-signature'];
    const timestamp = request.headers['x-timestamp'];
    const nonce = request.headers['x-nonce'];

    if (!signature || !timestamp || !nonce) {
      throw new UnauthorizedException(
        'Missing required signature headers (x-signature, x-timestamp, x-nonce)',
      );
    }

    // Validate timestamp to prevent replay attacks
    const requestTime = parseInt(timestamp, 10);
    if (isNaN(requestTime)) {
      throw new UnauthorizedException('Invalid timestamp format');
    }

    const now = Date.now();
    const timeDiff = Math.abs(now - requestTime);

    if (timeDiff > this.timestampToleranceMs) {
      this.logger.warn(
        `Request rejected: timestamp outside tolerance window (${timeDiff}ms > ${this.timestampToleranceMs}ms)`,
      );
      throw new UnauthorizedException(
        'Request timestamp outside acceptable window',
      );
    }

    // Check for nonce replay (in production, store nonces in Redis/cache)
    // For now, we'll skip nonce storage but validate its presence
    if (nonce.length < 16) {
      throw new UnauthorizedException('Nonce must be at least 16 characters');
    }

    // Build canonical request string
    const method = request.method;
    const path = request.path;
    const body = request.body ? JSON.stringify(request.body) : '';
    const canonicalString = `${method}\n${path}\n${timestamp}\n${nonce}\n${body}`;

    // Compute HMAC signature
    const computedSignature = this.computeHmacSignature(
      canonicalString,
      this.signatureSecret,
    );

    // Timing-safe comparison to prevent timing attacks
    const signatureBuffer = Buffer.from(signature, 'hex');
    const computedBuffer = Buffer.from(computedSignature, 'hex');

    if (
      signatureBuffer.length !== computedBuffer.length ||
      !timingSafeEqual(signatureBuffer, computedBuffer)
    ) {
      this.logger.warn(
        `Request rejected: invalid signature for ${method} ${path}`,
      );
      throw new UnauthorizedException('Invalid request signature');
    }

    this.logger.debug(`Request signature validated for ${method} ${path}`);

    return true;
  }

  private computeHmacSignature(data: string, secret: string): string {
    return createHmac('sha256', secret).update(data).digest('hex');
  }
}
