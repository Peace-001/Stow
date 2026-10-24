import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RequestSignerService } from './request-signer.service';

describe('RequestSignerService', () => {
  let service: RequestSignerService;
  const mockSecret = 'test-secret-key-for-hmac-signing';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequestSignerService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'REQUEST_SIGNATURE_SECRET') return mockSecret;
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<RequestSignerService>(RequestSignerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should generate signed request headers', () => {
    const headers = service.signRequest('POST', '/api/test', { data: 'test' });

    expect(headers).toHaveProperty('x-signature');
    expect(headers).toHaveProperty('x-timestamp');
    expect(headers).toHaveProperty('x-nonce');

    expect(headers['x-signature']).toHaveLength(64); // SHA256 hex
    expect(headers['x-nonce']).toHaveLength(64); // 32 bytes hex
    expect(parseInt(headers['x-timestamp'], 10)).toBeGreaterThan(0);
  });

  it('should generate different nonces for each request', () => {
    const headers1 = service.signRequest('GET', '/api/test');
    const headers2 = service.signRequest('GET', '/api/test');

    expect(headers1['x-nonce']).not.toBe(headers2['x-nonce']);
  });

  it('should generate different signatures for different methods', () => {
    const body = { data: 'test' };
    const headers1 = service.signRequest('GET', '/api/test', body);
    const headers2 = service.signRequest('POST', '/api/test', body);

    expect(headers1['x-signature']).not.toBe(headers2['x-signature']);
  });

  it('should generate different signatures for different paths', () => {
    const body = { data: 'test' };
    const headers1 = service.signRequest('POST', '/api/test1', body);
    const headers2 = service.signRequest('POST', '/api/test2', body);

    expect(headers1['x-signature']).not.toBe(headers2['x-signature']);
  });

  it('should generate different signatures for different bodies', () => {
    const headers1 = service.signRequest('POST', '/api/test', { data: 'test1' });
    const headers2 = service.signRequest('POST', '/api/test', { data: 'test2' });

    expect(headers1['x-signature']).not.toBe(headers2['x-signature']);
  });

  it('should verify valid signatures', () => {
    const method = 'POST';
    const path = '/api/test';
    const body = { data: 'test' };

    const headers = service.signRequest(method, path, body);

    const isValid = service.verifySignature(
      method,
      path,
      headers['x-timestamp'],
      headers['x-nonce'],
      body,
      headers['x-signature'],
    );

    expect(isValid).toBe(true);
  });

  it('should reject invalid signatures', () => {
    const method = 'POST';
    const path = '/api/test';
    const body = { data: 'test' };

    const headers = service.signRequest(method, path, body);

    const isValid = service.verifySignature(
      method,
      path,
      headers['x-timestamp'],
      headers['x-nonce'],
      body,
      'invalid-signature',
    );

    expect(isValid).toBe(false);
  });

  it('should handle empty body correctly', () => {
    const headers = service.signRequest('GET', '/api/test');

    expect(headers).toHaveProperty('x-signature');
    expect(headers['x-signature']).toHaveLength(64);
  });

  it('should throw error when secret not configured', () => {
    const module = Test.createTestingModule({
      providers: [
        RequestSignerService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(() => null),
          },
        },
      ],
    });

    module.compile().then((compiled) => {
      const invalidService = compiled.get<RequestSignerService>(
        RequestSignerService,
      );

      expect(() => {
        invalidService.signRequest('GET', '/api/test');
      }).toThrow('REQUEST_SIGNATURE_SECRET not configured');
    });
  });
});
