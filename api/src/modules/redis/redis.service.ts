// redis.service.ts ΓÇö DOC-000019 S8: Sessions, rate-limiting, config cache, correlation IDs
// Canon: "Redis 7.0 Sentinel cluster declared for caching & transient coordination"
// MVP: graceful fallback to in-memory when Redis unavailable
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('RedisService');
  private client: any = null;
  private connected = false;
  private memoryCache: Map<string, { value: string; expiresAt?: number }> = new Map();

  async onModuleInit() {
    try {
      const IORedis = require('ioredis');
      this.client = new IORedis({ host: process.env.REDIS_HOST || '127.0.0.1', port: parseInt(process.env.REDIS_PORT || '6379'), maxRetriesPerRequest: 1, lazyConnect: true, connectTimeout: 2000 });
      await this.client.connect();
      await this.client.ping();
      this.connected = true;
      this.logger.log('Redis connected ΓÇö caching ACTIVE');
    } catch {
      this.connected = false;
      this.logger.warn('Redis not available ΓÇö using in-memory cache (MVP localhost)');
    }
  }

  async onModuleDestroy() { if (this.client && this.connected) { try { await this.client.disconnect(); } catch {} } }

  async get(key: string): Promise<string | null> {
    if (this.connected) return this.client.get(key);
    const entry = this.memoryCache.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) { this.memoryCache.delete(key); return null; }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (this.connected) { if (ttlSeconds) await this.client.setex(key, ttlSeconds, value); else await this.client.set(key, value); return; }
    this.memoryCache.set(key, { value, expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined });
  }

  async del(key: string): Promise<void> { if (this.connected) await this.client.del(key); else this.memoryCache.delete(key); }
  async incr(key: string): Promise<number> { if (this.connected) return this.client.incr(key); const v = parseInt(await this.get(key) || '0') + 1; await this.set(key, String(v)); return v; }

  /** Rate limiting ΓÇö Canon: rate limits are policy-defined */
  async checkRateLimit(key: string, maxRequests: number, windowSeconds: number): Promise<{ allowed: boolean; current: number; limit: number }> {
    const rlKey = 'rl:' + key;
    const current = await this.incr(rlKey);
    if (current === 1) await this.set(rlKey, '1', windowSeconds);
    return { allowed: current <= maxRequests, current, limit: maxRequests };
  }

  getStatus() { return { connected: this.connected, mode: this.connected ? 'REDIS' : 'IN_MEMORY', memoryCacheSize: this.memoryCache.size }; }
}
