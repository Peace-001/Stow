import { Injectable, OnModuleInit } from '@nestjs/common';
import * as client from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly registry: client.Registry;

  readonly httpRequestDuration: client.Histogram;
  readonly httpRequestsTotal: client.Counter;
  readonly activeConnections: client.Gauge;

  readonly depositsTotal: client.Counter;
  readonly depositAmountTotal: client.Counter;
  readonly withdrawalsTotal: client.Counter;
  readonly withdrawalAmountTotal: client.Counter;
  readonly goalsCreated: client.Counter;
  readonly goalsReached: client.Counter;
  readonly groupsCreated: client.Counter;
  readonly savingsBalanceTotal: client.Gauge;
  readonly insuranceClaimsTotal: client.Counter;

  constructor() {
    this.registry = new client.Registry();

    this.registry.setDefaultLabels({ app: 'stow-api' });

    this.httpRequestDuration = new client.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'] as const,
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    this.httpRequestsTotal = new client.Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'] as const,
      registers: [this.registry],
    });

    this.activeConnections = new client.Gauge({
      name: 'active_connections',
      help: 'Number of active HTTP connections',
      registers: [this.registry],
    });

    this.depositsTotal = new client.Counter({
      name: 'stow_deposits_total',
      help: 'Total number of deposits',
      labelNames: ['type'] as const,
      registers: [this.registry],
    });

    this.depositAmountTotal = new client.Counter({
      name: 'stow_deposit_amount_total',
      help: 'Total deposit amount in stroops',
      labelNames: ['type'] as const,
      registers: [this.registry],
    });

    this.withdrawalsTotal = new client.Counter({
      name: 'stow_withdrawals_total',
      help: 'Total number of withdrawals',
      labelNames: ['type'] as const,
      registers: [this.registry],
    });

    this.withdrawalAmountTotal = new client.Counter({
      name: 'stow_withdrawal_amount_total',
      help: 'Total withdrawal amount in stroops',
      labelNames: ['type'] as const,
      registers: [this.registry],
    });

    this.goalsCreated = new client.Counter({
      name: 'stow_goals_created_total',
      help: 'Total number of savings goals created',
      registers: [this.registry],
    });

    this.goalsReached = new client.Counter({
      name: 'stow_goals_reached_total',
      help: 'Total number of savings goals reached',
      registers: [this.registry],
    });

    this.groupsCreated = new client.Counter({
      name: 'stow_groups_created_total',
      help: 'Total number of savings groups created',
      registers: [this.registry],
    });

    this.savingsBalanceTotal = new client.Gauge({
      name: 'stow_savings_balance_total',
      help: 'Total savings balance across all accounts in stroops',
      registers: [this.registry],
    });

    this.insuranceClaimsTotal = new client.Counter({
      name: 'stow_insurance_claims_total',
      help: 'Total number of insurance claims',
      labelNames: ['status'] as const,
      registers: [this.registry],
    });
  }

  onModuleInit() {
    client.collectDefaultMetrics({ register: this.registry });
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  getContentType(): string {
    return this.registry.contentType;
  }

  recordDeposit(type: string, amount: number): void {
    this.depositsTotal.inc({ type });
    this.depositAmountTotal.inc({ type }, amount);
  }

  recordWithdrawal(type: string, amount: number): void {
    this.withdrawalsTotal.inc({ type });
    this.withdrawalAmountTotal.inc({ type }, amount);
  }

  recordGoalCreated(): void {
    this.goalsCreated.inc();
  }

  recordGoalReached(): void {
    this.goalsReached.inc();
  }

  recordGroupCreated(): void {
    this.groupsCreated.inc();
  }

  setSavingsBalance(balance: number): void {
    this.savingsBalanceTotal.set(balance);
  }

  recordInsuranceClaim(status: string): void {
    this.insuranceClaimsTotal.inc({ status });
  }
}
