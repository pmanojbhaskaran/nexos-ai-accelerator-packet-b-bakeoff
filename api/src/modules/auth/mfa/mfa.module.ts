import { Module } from '@nestjs/common';
import { MfaController } from './mfa.controller';
import { MfaService } from './mfa.service';
import { PrismaService } from '../../../prisma/prisma.service';

@Module({
  controllers: [MfaController],
  providers: [PrismaService, MfaService],
  exports: [MfaService],
})
export class MfaModule {}
