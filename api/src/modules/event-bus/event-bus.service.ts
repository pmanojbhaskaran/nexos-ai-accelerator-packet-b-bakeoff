// event-bus.service.ts ΓÇö DOC-000012 Topic ACL, DOC-000019 S9: Event-driven architecture
// Canon: "Only named Producer may emit Topic. Only named Consumers may subscribe. DLQ mandatory after 3 retries."
// MVP: BullMQ-backed with graceful fallback to in-memory when Redis unavailable
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';

interface CanonicalEvent { topic: string; tenantId: string; payload: any; producerService: string; correlationId: string; occurredAt: string; }
type EventHandler = (event: CanonicalEvent) => Promise<void>;

const CANONICAL_TOPICS = [
  'org.ops.shipment.created.v1', 'org.ops.shipment.state_changed.v1', 'org.ops.scan.recorded.v1',
  'org.ops.exception.opened.v1', 'org.ops.exception.closed.v1',
  'org.controltower.escalation.opened.v1', 'org.controltower.escalation.sla_breached.v1',
  'org.billing.invoice.issued.v1', 'org.billing.invoice.overdue.v1',
  'org.saas.subscription.state_changed.v1', 'org.saas.entitlement.denied.v1',
  'org.saas.dunning.escalated.v1', 'org.sla.clock.breached.v1',
  'org.audit.policy_decision.v1', 'org.pod.sealed.v1',
];

// Topic ACL Registry per DOC-000012
const TOPIC_ACL: Record<string, { producers: string[]; consumers: string[]; priority: string; delivery: string }> = {
  'org.ops.shipment.created.v1': { producers: ['ShipmentLifecycleService'], consumers: ['BillingService','LearningService','ControlTowerUI'], priority: 'CRITICAL', delivery: 'EXACTLY_ONCE' },
  'org.ops.shipment.state_changed.v1': { producers: ['ShipmentLifecycleService'], consumers: ['EscalationOrchestrator','BillingService','ControlTowerUI'], priority: 'CRITICAL', delivery: 'FIFO' },
  'org.ops.scan.recorded.v1': { producers: ['ScanEventService'], consumers: ['ShipmentLifecycleService','ExceptionRegisterService'], priority: 'HIGH', delivery: 'FIFO' },
  'org.ops.exception.opened.v1': { producers: ['ExceptionRegisterService'], consumers: ['EscalationOrchestrator','LearningService'], priority: 'CRITICAL', delivery: 'FIFO' },
  'org.ops.exception.closed.v1': { producers: ['ExceptionRegisterService'], consumers: ['ShipmentLifecycleService','LearningService'], priority: 'HIGH', delivery: 'FIFO' },
  'org.controltower.escalation.opened.v1': { producers: ['EscalationOrchestrator'], consumers: ['ControlTowerUI','NotificationService'], priority: 'CRITICAL', delivery: 'FIFO' },
  'org.controltower.escalation.sla_breached.v1': { producers: ['EscalationOrchestrator'], consumers: ['ControlTowerUI','AlertingService'], priority: 'CRITICAL', delivery: 'FIFO' },
  'org.billing.invoice.issued.v1': { producers: ['BillingService'], consumers: ['CustomerUI','NotificationService'], priority: 'HIGH', delivery: 'EXACTLY_ONCE' },
  'org.billing.invoice.overdue.v1': { producers: ['BillingService'], consumers: ['CollectionsService','AlertingService'], priority: 'HIGH', delivery: 'FIFO' },
  'org.sla.clock.breached.v1': { producers: ['SlaEngineService'], consumers: ['ControlTowerUI','EscalationOrchestrator'], priority: 'CRITICAL', delivery: 'FIFO' },
};

@Injectable()
export class EventBusService implements OnModuleInit {
  private readonly logger = new Logger('EventBus');
  private handlers: Map<string, EventHandler[]> = new Map();
  private dlq: CanonicalEvent[] = [];
  private useRedis = false;
  private bullQueue: any = null;

  async onModuleInit() {
    try {
      const IORedis = require('ioredis');
      const redis = new IORedis({ host: process.env.REDIS_HOST || '127.0.0.1', port: parseInt(process.env.REDIS_PORT || '6379'), maxRetriesPerRequest: 1, lazyConnect: true, connectTimeout: 2000 });
      await redis.connect();
      await redis.ping();
      this.useRedis = true;
      redis.disconnect();
      this.logger.log('Redis available ΓÇö BullMQ event bus ACTIVE');
    } catch {
      this.useRedis = false;
      this.logger.warn('Redis not available ΓÇö using in-memory event bus (MVP localhost mode)');
    }
  }

  /** Publish event ΓÇö Canon: only named producer may emit topic */
  async publish(event: CanonicalEvent): Promise<{ published: boolean; topic: string; mode: string }> {
    const acl = TOPIC_ACL[event.topic];
    if (acl && !acl.producers.includes(event.producerService)) {
      this.logger.warn('ACL VIOLATION: ' + event.producerService + ' not authorized for ' + event.topic);
      return { published: false, topic: event.topic, mode: 'ACL_BLOCKED' };
    }

    if (this.useRedis) {
      try {
        const { Queue } = require('bullmq');
        const queue = new Queue(event.topic, { connection: { host: process.env.REDIS_HOST || '127.0.0.1', port: parseInt(process.env.REDIS_PORT || '6379') } });
        await queue.add(event.topic, event, { attempts: 3, backoff: { type: 'exponential', delay: 1000 } });
        await queue.close();
        return { published: true, topic: event.topic, mode: 'BULLMQ' };
      } catch (err) {
        this.logger.error('BullMQ publish failed, falling back to in-memory: ' + err);
      }
    }

    // In-memory fallback
    const handlers = this.handlers.get(event.topic) || [];
    for (const handler of handlers) {
      try { await handler(event); } catch (err) { this.dlq.push(event); this.logger.error('Handler failed, event moved to DLQ: ' + event.topic); }
    }
    return { published: true, topic: event.topic, mode: 'IN_MEMORY' };
  }

  /** Subscribe to topic ΓÇö Canon: only named consumers may subscribe */
  subscribe(topic: string, consumerName: string, handler: EventHandler) {
    const acl = TOPIC_ACL[topic];
    if (acl && !acl.consumers.includes(consumerName)) {
      this.logger.warn('ACL VIOLATION: ' + consumerName + ' not authorized to consume ' + topic);
      return;
    }
    const existing = this.handlers.get(topic) || [];
    existing.push(handler);
    this.handlers.set(topic, existing);
    this.logger.log('Subscribed: ' + consumerName + ' -> ' + topic);
  }

  /** Get registered topics */
  getTopicRegistry() { return { canonical: CANONICAL_TOPICS, aclEntries: Object.keys(TOPIC_ACL).length, mode: this.useRedis ? 'BULLMQ' : 'IN_MEMORY' }; }

  /** Get DLQ contents */
  getDlq() { return { count: this.dlq.length, events: this.dlq.slice(-20) }; }

  /** Get topic ACL for a specific topic */
  getTopicAcl(topic: string) { return TOPIC_ACL[topic] || null; }
}
