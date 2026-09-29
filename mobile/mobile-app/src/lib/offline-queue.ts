/**
 * Offline Queue ΓÇö Durable offline-first foundation
 * Canon: DOC-000060, Cluster 1.5.5
 * All POST calls go through this queue.
 * Queue persists via AsyncStorage. Syncs when online.
 * Each item has: durable timestamps, device identity, reconciliation flags.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type QueueStorageBackend = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

let storageBackendOverride: QueueStorageBackend | null = null;

/** Bake-off test seam — defaults to AsyncStorage in production mobile paths. */
export function setOfflineQueueStorageBackend(backend: QueueStorageBackend | null): void {
  storageBackendOverride = backend;
}

function storage(): QueueStorageBackend {
  return storageBackendOverride ?? AsyncStorage;
}

const QUEUE_KEY = "nexos_courier_offline_queue";
const LEGACY_QUEUE_KEY = "exeed_offline_queue";
const DEVICE_ID_KEY = "nexos_courier_device_id";
const LEGACY_DEVICE_ID_KEY = "exeed_device_id";

export interface OfflineQueueItem {
  id: string;
  path: string;
  method: "POST" | "PUT";
  body: Record<string, any>;
  tenantId: string;
  actorId: string;
  correlationId: string;
  queuedAt: string;
  deviceId: string;
  retryCount: number;
  lastError: string | null;
  status: "QUEUED" | "SYNCING" | "SYNCED" | "FAILED";
  reconciledAt: string | null;
}

function generateId(): string { return `oq_${Date.now()}_${Math.random().toString(36).slice(2,8)}`; }

async function readStorageWithAlias(primaryKey: string, legacyKey: string): Promise<string | null> {
  const primary = await storage().getItem(primaryKey);
  if (primary !== null) return primary;
  const legacy = await storage().getItem(legacyKey);
  if (legacy !== null) {
    await storage().setItem(primaryKey, legacy);
    return legacy;
  }
  return null;
}

async function writeStorageWithAlias(primaryKey: string, legacyKey: string, value: string): Promise<void> {
  await storage().setItem(primaryKey, value);
  await storage().setItem(legacyKey, value);
}

async function removeStorageWithAlias(primaryKey: string, legacyKey: string): Promise<void> {
  await storage().removeItem(primaryKey);
  await storage().removeItem(legacyKey);
}

let deviceIdCache: string | null = null;
async function getDeviceId(): Promise<string> {
  if (deviceIdCache) return deviceIdCache;
  let id = await readStorageWithAlias(DEVICE_ID_KEY, LEGACY_DEVICE_ID_KEY);
  if (!id) {
    id = `dev_${Date.now()}_${Math.random().toString(36).slice(2,10)}`;
    await writeStorageWithAlias(DEVICE_ID_KEY, LEGACY_DEVICE_ID_KEY, id);
  }
  deviceIdCache = id;
  return id;
}

/** Load all queued items from durable storage */
export async function loadQueue(): Promise<OfflineQueueItem[]> {
  try {
    const raw = await readStorageWithAlias(QUEUE_KEY, LEGACY_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

/** Save queue to durable storage */
async function saveQueue(items: OfflineQueueItem[]): Promise<void> {
  await writeStorageWithAlias(QUEUE_KEY, LEGACY_QUEUE_KEY, JSON.stringify(items));
}

/** Enqueue a POST/PUT request for later sync */
export async function enqueue(input: { path: string; method: "POST" | "PUT"; body: Record<string, any>; tenantId: string; actorId: string; correlationId: string; }): Promise<OfflineQueueItem> {
  const deviceId = await getDeviceId();
  const item: OfflineQueueItem = {
    id: generateId(), path: input.path, method: input.method, body: input.body,
    tenantId: input.tenantId, actorId: input.actorId, correlationId: input.correlationId,
    queuedAt: new Date().toISOString(), deviceId, retryCount: 0, lastError: null,
    status: "QUEUED", reconciledAt: null,
  };
  const queue = await loadQueue();
  queue.push(item);
  await saveQueue(queue);
  return item;
}

/** Flush queue ΓÇö attempt to sync all QUEUED items via provided fetch fn */
export async function flushQueue(apiFetch: (path: string, method: string, body: any, headers: Record<string, string>) => Promise<any>): Promise<{ synced: number; failed: number; remaining: number }> {
  const queue = await loadQueue();
  let synced = 0; let failed = 0;
  for (const item of queue) {
    if (item.status !== "QUEUED" && item.status !== "FAILED") continue;
    item.status = "SYNCING";
    try {
      await apiFetch(item.path, item.method, item.body, { "x-tenant-id": item.tenantId, "x-actor-id": item.actorId, "x-correlation-id": item.correlationId, "x-device-id": item.deviceId, "x-offline-queued-at": item.queuedAt });
      item.status = "SYNCED"; item.reconciledAt = new Date().toISOString(); synced++;
    } catch (e: any) {
      item.status = "FAILED"; item.retryCount++; item.lastError = e?.message || "UNKNOWN"; failed++;
    }
  }
  const remaining = queue.filter(i => i.status === "QUEUED" || i.status === "FAILED").length;
  await saveQueue(queue);
  return { synced, failed, remaining };
}

/** Get queue stats */
export async function queueStats(): Promise<{ total: number; queued: number; synced: number; failed: number }> {
  const q = await loadQueue();
  return { total: q.length, queued: q.filter(i => i.status === "QUEUED").length, synced: q.filter(i => i.status === "SYNCED").length, failed: q.filter(i => i.status === "FAILED").length };
}

/** Clear synced items from queue */
export async function purgeSynced(): Promise<number> {
  const q = await loadQueue();
  const before = q.length;
  const remaining = q.filter(i => i.status !== "SYNCED");
  await saveQueue(remaining);
  return before - remaining.length;
}

/** C2 compatibility: clear all queue/device storage keys */
export async function clearOfflineStorageAliases(): Promise<void> {
  deviceIdCache = null;
  await removeStorageWithAlias(QUEUE_KEY, LEGACY_QUEUE_KEY);
  await removeStorageWithAlias(DEVICE_ID_KEY, LEGACY_DEVICE_ID_KEY);
}
