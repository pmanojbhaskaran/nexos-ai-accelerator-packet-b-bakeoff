import { bootstrapOpenTelemetry } from './common/observability/otel-bootstrap';
bootstrapOpenTelemetry();

import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3001',
      'http://localhost:3100',
      'http://127.0.0.1:3100',
      'http://localhost:8081',
      'http://127.0.0.1:8081',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'content-type',
      'authorization',
      'x-tenant-id',
      'x-correlation-id',
      'x-actor-id',
      'x-auth-sub',
      'x-role-codes',
      'x-role-code',
      'x-display-name',
      'x-branch-code',
      'x-station-code',
      'x-session-id',
      'x-auth-sub',
      'x-client-platform',
      'x-request-id',
      'x-idempotency-key',
      'x-user-id',
  ],
    credentials: false,
  });

  app.setGlobalPrefix('api');

  const config = new DocumentBuilder()
    .setTitle('Tenex System API')
    .setVersion('0.1.0')
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'x-tenant-id',
        description: 'Tenant identifier (required)',
      },
      'x-tenant-id',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
  SwaggerModule.setup('api/docs-json', app, document);

  const port = Number(process.env.PORT || 3001);
  await app.listen(port);
}

bootstrap();
