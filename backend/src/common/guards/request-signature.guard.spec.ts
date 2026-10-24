import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { RequestSignatureGuard } from './request-signature.guard';
import { createHmac } from 'crypto';

describe('RequestSignatureGuard', () => {
  let guard: RequestSignatureGuard;
  let configService: ConfigService;
  let reflector: Reflector;

  const mockSecret = 'test-secret-key-for-hmac-signing';
  const mockTimestamp = Date.now().toString();
  const mockNonce = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequestSignatureGuard,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'REQUEST_SIGNATURE_SECRET') return mockSecret;
              if (key === 'REQUEST_SIGNATURE_TOLERANCE_MS') return 300000;
              return null;
            }),
          },
        },
        {
          provide: Reflector,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<RequestSignatureGuard>(RequestSignatureGuard);
    configService = module.get<ConfigService>(ConfigService);
    reflector = module.get<Reflector>(Reflector);
  });

  const createMockExecutionContext = (
    headers: any,
    body: any = {},
    requireSignature = true,
  ): ExecutionContext => {
    jest.spyOn(reflector, 'get').mockReturnValue(requireSignature);

    return {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          path: '/api/test',
          headers,
          body,
        }),
      }),
      getHandler: () => ({}),
    } as any;
  };

  const computeValidSignature = (
    method: string,
    path: string,
    timestamp: string,
    nonce: string,
    body: any,
  ): string => {
    const bodyString = body ? JSON.stringify(body) : '';
    const canonicalString = `${method}\n${path}\n${timestamp}\n${nonce}\n${bodyString}`;
    return createHmac('sha256', mockSecret).update(canonicalString).digest('hex');
  };

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow requests without signature when not required', async () => {
    const context = createMockExecutionContext({}, {}, false);
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('should reject request with missing signature headers', async () => {
    const context = createMockExecutionContext({});
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should reject request with invalid timestamp', async () => {
    const signature = computeValidSignature(
      'POST',
      '/api/test',
      'invalid',
      mockNonce,
      {},
    );

    const context = createMockExecutionContext({
      'x-signature': signature,
      'x-timestamp': 'invalid',
      'x-nonce': mockNonce,
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should reject request with expired timestamp', async () => {
    const oldTimestamp = (Date.now() - 400000).toString(); // 6+ minutes ago
    const signature = computeValidSignature(
      'POST',
      '/api/test',
      oldTimestamp,
      mockNonce,
      {},
    );

    const context = createMockExecutionContext({
      'x-signature': signature,
      'x-timestamp': oldTimestamp,
      'x-nonce': mockNonce,
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should reject request with short nonce', async () => {
    const signature = computeValidSignature(
      'POST',
      '/api/test',
      mockTimestamp,
      'short',
      {},
    );

    const context = createMockExecutionContext({
      'x-signature': signature,
      'x-timestamp': mockTimestamp,
      'x-nonce': 'short',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should reject request with invalid signature', async () => {
    const context = createMockExecutionContext({
      'x-signature': 'invalid-signature-value',
      'x-timestamp': mockTimestamp,
      'x-nonce': mockNonce,
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should accept request with valid signature', async () => {
    const body = { data: 'test' };
    const signature = computeValidSignature(
      'POST',
      '/api/test',
      mockTimestamp,
      mockNonce,
      body,
    );

    const context = createMockExecutionContext(
      {
        'x-signature': signature,
        'x-timestamp': mockTimestamp,
        'x-nonce': mockNonce,
      },
      body,
    );

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('should accept request with valid signature and empty body', async () => {
    const signature = computeValidSignature(
      'POST',
      '/api/test',
      mockTimestamp,
      mockNonce,
      null,
    );

    const context = createMockExecutionContext(
      {
        'x-signature': signature,
        'x-timestamp': mockTimestamp,
        'x-nonce': mockNonce,
      },
      null,
    );

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
