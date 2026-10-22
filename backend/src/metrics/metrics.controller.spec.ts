import { Test, TestingModule } from '@nestjs/testing';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

describe('MetricsController', () => {
  let controller: MetricsController;
  let service: MetricsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetricsController],
      providers: [MetricsService],
    }).compile();

    controller = module.get<MetricsController>(MetricsController);
    service = module.get<MetricsService>(MetricsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return metrics with correct content type', async () => {
    const mockRes = {
      set: jest.fn(),
      send: jest.fn(),
    };

    await controller.getMetrics(mockRes as any);

    expect(mockRes.set).toHaveBeenCalledWith(
      'Content-Type',
      expect.stringContaining('text/plain'),
    );
    expect(mockRes.send).toHaveBeenCalledWith(expect.any(String));
  });
});
