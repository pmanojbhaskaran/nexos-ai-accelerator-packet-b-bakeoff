/**
 * OpenTelemetry Bootstrap ΓÇö DOC-000014 (Observability Canon)
 *
 * MUST be called BEFORE NestFactory.create() in main.ts.
 * Uses OTel SDK v2.x API: resourceFromAttributes() instead of new Resource().
 */
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

let sdk: NodeSDK | null = null;

export function bootstrapOpenTelemetry(): void {
  // Skip in test environment
  if (process.env.NODE_ENV === 'test') return;

  const prometheusExporter = new PrometheusExporter(
    { port: 9464, preventServerStart: false },
    () => {
      console.log('[OTel] Prometheus metrics exposed on :9464/metrics');
    },
  );

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: 'tenex-system-api',
      [ATTR_SERVICE_VERSION]: process.env.npm_package_version ?? '0.0.0',
    }),
    metricReader: prometheusExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-http': { enabled: true },
        '@opentelemetry/instrumentation-express': { enabled: true },
      }),
    ],
  });

  sdk.start();
  console.log('[OTel] OpenTelemetry SDK initialized ΓÇö tracing + metrics active');

  process.on('SIGTERM', () => {
    sdk?.shutdown().then(
      () => console.log('[OTel] SDK shut down cleanly'),
      (err) => console.error('[OTel] SDK shutdown error', err),
    );
  });
}
