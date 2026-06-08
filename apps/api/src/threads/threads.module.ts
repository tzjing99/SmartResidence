import { NotificationModule } from '@/notification/notification.module';
import { Module } from '@nestjs/common';
import { AI_ASSIST_PROVIDER } from './ai/ai-assist.provider';
import { CompositeAiAssistProvider } from './ai/composite-ai-assist.provider';
import { MlPriorityService } from './ml/ml-priority.service';
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
    MlPriorityService,
    CompositeAiAssistProvider,
    { provide: AI_ASSIST_PROVIDER, useClass: CompositeAiAssistProvider },
  ],
  exports: [ThreadsService, SlaService, MlPriorityService],
})
export class ThreadsModule {}
