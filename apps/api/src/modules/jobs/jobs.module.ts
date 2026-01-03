import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { JobsService } from './jobs.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'process-inbound-message',
    }),
    BullModule.registerQueue({
      name: 'schedule-confirmations',
    }),
    BullModule.registerQueue({
      name: 'send-reminders',
    }),
  ],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}

