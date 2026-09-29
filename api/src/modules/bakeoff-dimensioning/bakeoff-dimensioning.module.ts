import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { BakeoffDimensioningController } from './bakeoff-dimensioning.controller';
import { BakeoffDimensioningService } from './bakeoff-dimensioning.service';

@Module({
  imports: [PrismaModule],
  controllers: [BakeoffDimensioningController],
  providers: [BakeoffDimensioningService],
})
export class BakeoffDimensioningModule {}
