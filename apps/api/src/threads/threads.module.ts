import { NotificationModule } from '@/notification/notification.module';
import { Module } from '@nestjs/common';
import { AI_ASSIST_PROVIDER, RuleBasedAiAssistProvider } from './ai/ai-assist.provider';
import { SlaService } from './sla/sla.service';
import { ThreadPriorityService } from './sla/thread-priority.service';
import { ThreadAssignmentService } from './thread-assignment.service';
import { ThreadsController } from './threads.controller';
import { ThreadsService } from './threads.service';

@Module({
  imports: [NotificationModule],
  controllers: [ThreadsController],
  providers: [
    ThreadsService,
    ThreadAssignmentService,
    SlaService,
    ThreadPriorityService,
    { provide: AI_ASSIST_PROVIDER, useClass: RuleBasedAiAssistProvider },
  ],
  exports: [ThreadsService, SlaService],
})
export class ThreadsModule {}
