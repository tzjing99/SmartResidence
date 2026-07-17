import { Module } from '@nestjs/common';
import { AccessRestrictionController } from './access-restriction.controller';
import { AccessRestrictionService } from './access-restriction.service';

@Module({
  providers: [AccessRestrictionService],
  controllers: [AccessRestrictionController],
  exports: [AccessRestrictionService],
})
export class AccessRestrictionModule {}
