/**
 * Mobile API Hooks ΓÇö Cluster 1.5 wiring
 * Canon: DOC-000060, DOC-000061
 * All POST calls route through offline-queue for offline-first.
 */
import { ApiClient, resolveOperationalTenantId } from '../api/ApiClient';
import { resolveMobileApiBaseUrl } from './resolve-mobile-api-base-url';
import { enqueue, flushQueue } from './offline-queue';
import { buildExceptionTransitionRequest } from './ops-exception-lifecycle';

const baseUrl = resolveMobileApiBaseUrl();
const tenantId = resolveOperationalTenantId(process.env as any);
const client = new ApiClient({ baseUrl, tenantId });

function cid(): string { return `mob_${Date.now()}_${Math.random().toString(36).slice(2,8)}`; }

// ΓöÇΓöÇ 1.5.1 Pickup Flow ΓöÇΓöÇ
export async function executePickup(shipmentId: string, body: { agent_id: string; evidence_count: number; package_count: number; pickup_timestamp: string }) {
  const path = `/shipments/${shipmentId}/pickup`;
  try { return await client.post(path, body); }
  catch { return enqueue({ path, method: "POST", body, tenantId, actorId: body.agent_id, correlationId: cid() }); }
}

export async function executeOriginInscan(shipmentId: string, body: { facility_id: string; scan_value: string; condition: string }) {
  const path = `/shipments/${shipmentId}/origin-hub-inscan`;
  try { return await client.post(path, body); }
  catch { return enqueue({ path, method: "POST", body, tenantId, actorId: "system", correlationId: cid() }); }
}

// ΓöÇΓöÇ 1.5.2 Transit Flow ΓöÇΓöÇ
export async function executeDispatch(shipmentId: string, body: { manifest_reference: string; bag_seal_reference: string; handoff_scan_reference: string }) {
  const path = `/shipments/${shipmentId}/dispatch`;
  try { return await client.post(path, body); }
  catch { return enqueue({ path, method: "POST", body, tenantId, actorId: "system", correlationId: cid() }); }
}

export async function executeLinehaulBooking(shipmentId: string, body: { linehaul_ref: string; vehicle_ref: string }) {
  const path = `/shipments/${shipmentId}/linehaul`;
  try { return await client.post(path, body); }
  catch { return enqueue({ path, method: "POST", body, tenantId, actorId: "system", correlationId: cid() }); }
}

export async function executeTransitEvent(shipmentId: string, body: { event_type: string; location: string; timestamp: string }) {
  const path = `/shipments/${shipmentId}/transit-event`;
  try { return await client.post(path, body); }
  catch { return enqueue({ path, method: "POST", body, tenantId, actorId: "system", correlationId: cid() }); }
}

// ΓöÇΓöÇ 1.5.3 Delivery Flow ΓöÇΓöÇ
export async function executeDelivery(shipmentId: string, body: { agent_id: string; receiver_name: string; delivery_timestamp: string; pod_evidence: { type: string; value: string; captured_at: string }[]; geo_lat?: number; geo_lng?: number }) {
  const path = `/shipments/${shipmentId}/deliver`;
  try { return await client.post(path, body); }
  catch { return enqueue({ path, method: "POST", body, tenantId, actorId: body.agent_id, correlationId: cid() }); }
}

export async function getPod(shipmentId: string) {
  return client.get(`/shipments/${shipmentId}/pod`);
}

// ΓöÇΓöÇ 1.5.4 NDR & Exception Flow ΓöÇΓöÇ
export async function recordNdr(body: { shipmentId: string; ndrReasonCode: string; attemptNumber: number; occurredAt: string; agentId?: string; notes?: string; actorId: string }) {
  const path = "/ndr";
  try { return await client.post(path, body); }
  catch { return enqueue({ path, method: "POST", body, tenantId, actorId: body.actorId, correlationId: cid() }); }
}

export async function transitionException(exceptionId: string, body: { targetState: string; actorId: string; evidenceRef?: string; notes?: string }) {
  const path = "/exceptions/transition";
  const requestBody = buildExceptionTransitionRequest({
    exceptionId,
    targetState: body.targetState,
    actorId: body.actorId,
    evidenceRef: body.evidenceRef,
    notes: body.notes,
  });
  try {
    return await client.post(path, requestBody);
  } catch {
    return enqueue({
      path,
      method: "POST",
      body: requestBody,
      tenantId,
      actorId: body.actorId,
      correlationId: cid(),
    });
  }
}

export async function punchAttendance(body: { employeeRef: string; action: "CHECK_IN" | "CHECK_OUT"; source?: string }) {
  const path = "/v0/attendance/punch";
  const payload = { ...body, source: body.source ?? "MOBILE" };
  try { return await client.post(path, payload); }
  catch { return enqueue({ path, method: "POST", body: payload, tenantId, actorId: body.employeeRef, correlationId: cid() }); }
}

export async function getCurrentAttendance(employeeRef: string) {
  return client.get(`/v0/attendance/current?employeeRef=${encodeURIComponent(employeeRef)}`);
}

export async function persistHubScan(body: { scanValue: string; facilityId?: string; shipmentId?: string; bagId?: string }) {
  const path = "/v0/hub-scans";
  try { return await client.post(path, body); }
  catch { return enqueue({ path, method: "POST", body, tenantId, actorId: "system", correlationId: cid() }); }
}

export async function listAirportTasks(taskKind?: string) {
  const query = taskKind ? `?taskKind=${encodeURIComponent(taskKind)}` : "";
  return client.get(`/v0/airport-tasks${query}`);
}

export async function completeAirportTask(taskId: string, body: { evidenceRef?: string }) {
  const path = `/v0/airport-tasks/${taskId}/complete`;
  try { return await client.post(path, body); }
  catch { return enqueue({ path, method: "POST", body, tenantId, actorId: "system", correlationId: cid() }); }
}

export async function admitInternationalAir() {
  const path = "/v2/international-air/admit";
  try { return await client.post(path, { shipmentCategory: "INTERNATIONAL_AIR" }); }
  catch { return enqueue({ path, method: "POST", body: { shipmentCategory: "INTERNATIONAL_AIR" }, tenantId, actorId: "system", correlationId: cid() }); }
}

export async function captureInternationalAirField(kind: "references" | "documents" | "lifecycle", body: Record<string, unknown>) {
  const path = kind === "references"
    ? "/v2/international-air/references"
    : kind === "documents"
      ? "/v2/international-air/documents"
      : "/v2/international-air/lifecycle";
  try { return await client.post(path, body); }
  catch { return enqueue({ path, method: "POST", body, tenantId, actorId: "system", correlationId: cid() }); }
}

// ΓöÇΓöÇ Sync ΓöÇΓöÇ
export async function syncOfflineQueue() {
  return flushQueue(async (path, method, body, headers) => {
    const opts: RequestInit = { method, body: JSON.stringify(body), headers: { "Content-Type": "application/json", ...headers } };
    const res = await fetch(`${baseUrl}${path}`, opts);
    if (!res.ok) throw new Error(`API ${res.status}`);
    return res.json();
  });
}
