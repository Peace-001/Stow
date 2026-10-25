import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes } from 'crypto';

export interface SignedRequestHeaders {
  'x-signature': string;
  'x-timestamp': string;
  'x-nonce': string;
}

/**
 * Service for signing outgoing requests with HMAC-SHA256
 * Used by clients to generate valid request signatures
 */
@Injectable()
export class RequestSignerService {
  private readonly signatureSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.signatureSecret = this.configService.get<string>(
      'REQUEST_SIGNATURE_SECRET',
    );
  }

  /**
   * Sign a request with HMAC-SHA256
   * @param method HTTP method (GET, POST, etc.)
   * @param path Request path
   * @param body Request body (will be JSON stringified)
   * @returns Headers to include in the request
   */
  signRequest(
    method: string,
    path: string,
    body?: any,
  ): SignedRequestHeaders {
    if (!this.signatureSecret) {
      throw new Error('REQUEST_SIGNATURE_SECRET not configured');
    }

    const timestamp = Date.now().toString();
    const nonce = this.generateNonce();
    const bodyString = body ? JSON.stringify(body) : '';

    const canonicalString = `${method}\n${path}\n${timestamp}\n${nonce}\n${bodyString}`;
    const signature = this.computeHmacSignature(
      canonicalString,
      this.signatureSecret,
    );

    return {
      'x-signature': signature,
      'x-timestamp': timestamp,
      'x-nonce': nonce,
    };
  }

  /**
   * Generate a cryptographically secure nonce
   */
  private generateNonce(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Compute HMAC-SHA256 signature
   */
  private computeHmacSignature(data: string, secret: string): string {
    return createHmac('sha256', secret).update(data).digest('hex');
  }

  /**
   * Verify a signature (useful for testing)
   */
  verifySignature(
    method: string,
    path: string,
    timestamp: string,
    nonce: string,
    body: any,
    signature: string,
  ): boolean {
    const bodyString = body ? JSON.stringify(body) : '';
    const canonicalString = `${method}\n${path}\n${timestamp}\n${nonce}\n${bodyString}`;
    const computedSignature = this.computeHmacSignature(
      canonicalString,
      this.signatureSecret,
    );

    return signature === computedSignature;
  }
}
