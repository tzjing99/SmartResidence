import { PollsModule } from '@/polls/polls.module';
import { Module } from '@nestjs/common';
import { GovernanceController } from './governance.controller';
import { GovernanceService } from './governance.service';

@Module({
  imports: [PollsModule],
  providers: [GovernanceService],
  controllers: [GovernanceController],
  exports: [GovernanceService],
})
export class GovernanceModule {}
