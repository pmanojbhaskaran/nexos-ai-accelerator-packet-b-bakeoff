// audit.service.ts -- DOC-000020 Section 9: Audit-memory coupling
// Canon: Every authoritative Kernel-handled mutation shall produce attributable
//        audit memory sufficient to reconstruct what happened.
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { KernelOutputClass } from './kernel-output';

export interface AuditEntry {
  tenantId: string;
  correlationId: string;
  action: string;
  method: string;
  path: string;
  actorId: string;
  actorRole: string;
  actorType: string;
  outputClass: KernelOutputClass;
  policySnapshot?: Record<string, unknown>;
  conditions?: string[];
  evidenceRef?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  growthState?: string | null;
  durationMs?: number;
  errorCode?: string | null;
  errorMessage?: string | null;
}

@Injectable()
export class KernelAuditService {
  private readonly logger = new Logger(KernelAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<string | null> {
    try {
      const record = await (this.prisma as any).kernelAuditLog.create({
        data: {
          tenantId: entry.tenantId || 'UNKNOWN',
          correlationId: entry.correlationId,
          action: entry.action,
          method: entry.method,
          path: entry.path,
          actorId: entry.actorId || 'UNKNOWN',
          actorRole: entry.actorRole || 'UNKNOWN',
          actorType: entry.actorType || 'HUMAN',
          outputClass: entry.outputClass,
          policySnapshot: entry.policySnapshot || {},
          conditions: entry.conditions || [],
          evidenceRef: entry.evidenceRef || null,
          entityType: entry.entityType || null,
          entityId: entry.entityId || null,
          growthState: entry.growthState || null,
          durationMs: entry.durationMs || null,
          errorCode: entry.errorCode || null,
          errorMessage: entry.errorMessage || null,
        },
      });
      this.logger.log(
        'KR-AUD: ' + entry.outputClass + ' | ' + entry.action + ' | tenant=' + entry.tenantId + ' | actor=' + entry.actorId + '(' + entry.actorRole + ') | corr=' + entry.correlationId,
      );
      return record.id;
    } catch (err: any) {
      this.logger.error('KR-AUD-FAIL: ' + entry.action + ' | ' + err.message);
      return null;
    }
  }

  async queryByTenant(tenantId: string, opts: { skip?: number; take?: number; action?: string; outputClass?: string } = {}) {
    const where: any = { tenantId };
    if (opts.action) where.action = { contains: opts.action };
    if (opts.outputClass) where.outputClass = opts.outputClass;
    return (this.prisma as any).kernelAuditLog.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
      skip: opts.skip || 0,
      take: opts.take || 50,
    });
  }

  async queryAuditByCorrelation(tenantId: string, correlationId: string) {
    return (this.prisma as any).kernelAuditLog.findMany({
      where: { tenantId, correlationId },
      orderBy: { occurredAt: 'asc' },
    });
  }

  /** List audit entries with filters, skip, take. */
  async list(where: any, skip: number = 0, take: number = 50) {
    const [items, total] = await Promise.all([
      (this.prisma as any).kernelAuditLog.findMany({ where, orderBy: { occurredAt: 'desc' }, skip, take }),
      (this.prisma as any).kernelAuditLog.count({ where }),
    ]);
    return { items, total, skip, take };
  }

  /** Get a single audit entry by ID. */
  async getById(id: string) {
    return (this.prisma as any).kernelAuditLog.findUnique({ where: { id } });
  }
}
