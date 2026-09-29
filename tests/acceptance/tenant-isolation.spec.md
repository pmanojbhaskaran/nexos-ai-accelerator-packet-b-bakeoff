# Tenant isolation acceptance (static)

Given TENANT_A_QA fixtures and TENANT_B_QA fixtures:

- Tenant A reads QA-AWB-0001 / BX01 succeeds under A credentials.
- Tenant A request for Tenant B shipment/package IDs returns 403 or 404 without revealing B existence details.
- Symmetric for Tenant B.
