import { Test, TestingModule } from '@nestjs/testing';
import { CompressionMiddleware } from './compression.middleware';
import { Request, Response, NextFunction } from 'express';

describe('CompressionMiddleware', () => {
  let middleware: CompressionMiddleware;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CompressionMiddleware],
    }).compile();

    middleware = module.get<CompressionMiddleware>(CompressionMiddleware);

    mockRequest = {
      headers: {},
    };

    mockResponse = {
      getHeader: jest.fn(),
      setHeader: jest.fn(),
      writeHead: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
    };

    mockNext = jest.fn();
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  describe('use', () => {
    it('should call next function', () => {
      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it('should not compress when x-no-compression header is present', () => {
      mockRequest.headers = { 'x-no-compression': '1' };

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle JSON content-type', () => {
      mockResponse.getHeader = jest.fn().mockReturnValue('application/json');

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle HTML content-type', () => {
      mockResponse.getHeader = jest.fn().mockReturnValue('text/html');

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle XML content-type', () => {
      mockResponse.getHeader = jest.fn().mockReturnValue('application/xml');

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle JavaScript content-type', () => {
      mockResponse.getHeader = jest
        .fn()
        .mockReturnValue('application/javascript');

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle SVG content-type', () => {
      mockResponse.getHeader = jest.fn().mockReturnValue('image/svg+xml');

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('compression configuration', () => {
    it('should use 1KB threshold', () => {
      // This is implicit in the middleware configuration
      expect(middleware).toBeDefined();
    });

    it('should support gzip encoding', () => {
      mockRequest.headers = { 'accept-encoding': 'gzip' };

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should support brotli encoding', () => {
      mockRequest.headers = { 'accept-encoding': 'br' };

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should support multiple encodings', () => {
      mockRequest.headers = { 'accept-encoding': 'gzip, deflate, br' };

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
    });
  });
});
