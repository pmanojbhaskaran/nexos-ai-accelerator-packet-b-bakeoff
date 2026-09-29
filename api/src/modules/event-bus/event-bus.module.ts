/**
 * Event Bus Module ΓÇö DOC-000019
 * Provides RabbitMQ with EventEmitter fallback for local dev.
 */
import { Global, Module } from '@nestjs/common';
import { EventBusController } from './event-bus.controller';
import { EventBusService } from './event-bus.service';
import { RabbitMqProvider } from './rabbitmq.provider';

@Global()
@Module({
  controllers: [EventBusController],
  providers: [EventBusService, RabbitMqProvider],
  exports: [EventBusService, RabbitMqProvider],
})
export class EventBusModule {}
