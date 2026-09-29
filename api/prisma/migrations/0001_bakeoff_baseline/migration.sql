-- BAKEOFF_ONLY / NOT_PRODUCTION_MIGRATION_AUTHORITY
-- Covers all 17 Prisma models in api/prisma/schema.prisma

CREATE TABLE IF NOT EXISTS bakeoff_tenant (
  tenant_code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_identity (
  id UUID PRIMARY KEY,
  tenant_code TEXT NOT NULL,
  user_code TEXT NOT NULL,
  auth_subject TEXT NOT NULL,
  display_name TEXT NOT NULL,
  email TEXT,
  password_hash TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (tenant_code, auth_subject),
  UNIQUE (tenant_code, user_code)
);

CREATE TABLE IF NOT EXISTS user_role_assignment (
  id UUID PRIMARY KEY,
  tenant_code TEXT NOT NULL,
  user_code TEXT NOT NULL,
  role_code TEXT NOT NULL,
  UNIQUE (tenant_code, user_code, role_code),
  FOREIGN KEY (tenant_code, user_code) REFERENCES user_identity (tenant_code, user_code) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tenant_capability_config (
  id UUID PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  capability_code TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (tenant_id, capability_code)
);

CREATE TABLE IF NOT EXISTS tenant_role_permission (
  id UUID PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  role_code TEXT NOT NULL,
  capability_code TEXT NOT NULL,
  can_view BOOLEAN NOT NULL DEFAULT TRUE,
  can_create BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (tenant_id, role_code, capability_code)
);

CREATE TABLE IF NOT EXISTS shipment (
  id UUID PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  shipment_business_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'CREATED',
  UNIQUE (tenant_id, shipment_business_id)
);

CREATE TABLE IF NOT EXISTS shipment_package (
  id UUID PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  shipment_internal_id UUID NOT NULL REFERENCES shipment(id) ON DELETE CASCADE,
  package_barcode TEXT NOT NULL,
  label TEXT NOT NULL,
  UNIQUE (tenant_id, package_barcode)
);

CREATE TABLE IF NOT EXISTS hub_inbound_scan (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  shipment_ref TEXT NOT NULL,
  barcode_value TEXT NOT NULL,
  scan_type TEXT NOT NULL,
  scanned_by TEXT NOT NULL,
  scanned_at TIMESTAMPTZ NOT NULL,
  dimension_json JSONB,
  photo_ref TEXT
);

CREATE INDEX IF NOT EXISTS ix_hub_inbound_scan_tenant_barcode ON hub_inbound_scan (tenant_id, barcode_value);

CREATE TABLE IF NOT EXISTS package_dimension_capture (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  shipment_id TEXT NOT NULL,
  package_id UUID NOT NULL REFERENCES shipment_package(id) ON DELETE CASCADE,
  measurement_source TEXT NOT NULL,
  capture_method TEXT NOT NULL,
  length_cm DECIMAL(10,2) NOT NULL,
  width_cm DECIMAL(10,2) NOT NULL,
  height_cm DECIMAL(10,2) NOT NULL,
  unit TEXT NOT NULL DEFAULT 'CM',
  quality_result TEXT NOT NULL,
  confidence DECIMAL(5,4),
  decision TEXT NOT NULL,
  billing_eligible BOOLEAN NOT NULL DEFAULT FALSE,
  algorithm_version TEXT NOT NULL,
  calibration_version TEXT,
  device_id TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL,
  captured_by TEXT NOT NULL,
  evidence_ref TEXT,
  original_json JSONB,
  accepted_json JSONB,
  override_reason TEXT,
  correlation_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS proof_artifact (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  content_type TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL,
  captured_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shipment_event (
  id UUID PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  shipment_internal_id UUID NOT NULL REFERENCES shipment(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  correlation_id TEXT NOT NULL,
  metadata JSONB
);

CREATE TABLE IF NOT EXISTS shipment_audit_event (
  id UUID PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  result_status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS domain_event_record (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  payload JSONB NOT NULL,
  emitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  correlation_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mobile_task_queue (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  task_code TEXT NOT NULL,
  assigned_to TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'QUEUED',
  shipment_id TEXT,
  UNIQUE (tenant_id, task_code)
);

CREATE TABLE IF NOT EXISTS mobile_device (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, device_id)
);

CREATE TABLE IF NOT EXISTS mobile_sync_action (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  path TEXT NOT NULL,
  method TEXT NOT NULL,
  body_json JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'QUEUED',
  idempotency_key TEXT,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  synced_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_mobile_sync_action_tenant_device_status ON mobile_sync_action (tenant_id, device_id, status);

CREATE TABLE IF NOT EXISTS tenant_menu_config (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  menu_code TEXT NOT NULL,
  label TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (tenant_id, menu_code)
);
