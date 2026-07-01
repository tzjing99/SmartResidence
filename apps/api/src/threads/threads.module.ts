import { NotificationModule } from '@/notification/notification.module';
import { Module } from '@nestjs/common';
import { ASSIGNMENT_ASSIST_PROVIDER } from './ai/assignment-assist.provider';
import { RuleBasedAssignmentAssistProvider } from './ai/assignment-assist.provider';
import { AI_ASSIST_PROVIDER } from './ai/ai-assist.provider';
import { CompositeAiAssistProvider } from './ai/composite-ai-assist.provider';
import { CompositeAssignmentAssistProvider } from './ai/composite-assignment-assist.provider';
import { MlAssignmentService } from './ml/ml-assignment.service';
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
    MlAssignmentService,
    RuleBasedAssignmentAssistProvider,
    CompositeAssignmentAssistProvider,
    CompositeAiAssistProvider,
    { provide: ASSIGNMENT_ASSIST_PROVIDER, useClass: CompositeAssignmentAssistProvider },
    { provide: AI_ASSIST_PROVIDER, useClass: CompositeAiAssistProvider },
  ],
  exports: [ThreadsService, SlaService, MlPriorityService, MlAssignmentService],
})
export class ThreadsModule {}
