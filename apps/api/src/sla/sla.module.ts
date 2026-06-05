import { AnnouncementModule } from '@/announcement/announcement.module';
import { ThreadsModule } from '@/threads/threads.module';
import { Module } from '@nestjs/common';
import { SlaPolicyController } from './sla-policy.controller';
import { SlaPolicyService } from './sla-policy.service';

@Module({
  imports: [ThreadsModule, AnnouncementModule],
  controllers: [SlaPolicyController],
  providers: [SlaPolicyService],
  exports: [SlaPolicyService],
})
export class SlaModule {}
