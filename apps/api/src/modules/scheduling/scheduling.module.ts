import { Module } from '@nestjs/common';
import { SchedulingController } from './scheduling.controller';
import { SchedulingService } from './scheduling.service';
import { ToolsController } from './tools.controller';

@Module({
  controllers: [SchedulingController, ToolsController],
  providers: [SchedulingService],
  exports: [SchedulingService],
})
export class SchedulingModule {}

