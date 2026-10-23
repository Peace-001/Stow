import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MetricsService],
    }).compile();

    service = module.get<MetricsService>(MetricsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return prometheus-formatted metrics', async () => {
    const metrics = await service.getMetrics();
    expect(typeof metrics).toBe('string');
    expect(metrics).toContain('http_request_duration_seconds');
    expect(metrics).toContain('http_requests_total');
    expect(metrics).toContain('stow_deposits_total');
  });

  it('should return correct content type', () => {
    const contentType = service.getContentType();
    expect(contentType).toContain('text/plain');
  });

  it('should track deposits', async () => {
    service.recordDeposit('flexible', 100_000_000);
    service.recordDeposit('flexible', 50_000_000);
    service.recordDeposit('locked', 200_000_000);

    const metrics = await service.getMetrics();
    expect(metrics).toContain('stow_deposits_total');
    expect(metrics).toContain('stow_deposit_amount_total');
  });

  it('should track withdrawals', async () => {
    service.recordWithdrawal('flexible', 30_000_000);

    const metrics = await service.getMetrics();
    expect(metrics).toContain('stow_withdrawals_total');
    expect(metrics).toContain('stow_withdrawal_amount_total');
  });

  it('should track goals', async () => {
    service.recordGoalCreated();
    service.recordGoalReached();

    const metrics = await service.getMetrics();
    expect(metrics).toContain('stow_goals_created_total');
    expect(metrics).toContain('stow_goals_reached_total');
  });

  it('should track groups', async () => {
    service.recordGroupCreated();

    const metrics = await service.getMetrics();
    expect(metrics).toContain('stow_groups_created_total');
  });

  it('should set savings balance gauge', async () => {
    service.setSavingsBalance(1_000_000_000);

    const metrics = await service.getMetrics();
    expect(metrics).toContain('stow_savings_balance_total');
  });

  it('should track insurance claims', async () => {
    service.recordInsuranceClaim('approved');
    service.recordInsuranceClaim('redeemed');

    const metrics = await service.getMetrics();
    expect(metrics).toContain('stow_insurance_claims_total');
  });
});
