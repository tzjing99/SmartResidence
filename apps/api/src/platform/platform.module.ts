import { SetupModule } from '@/setup/setup.module';
import { Module } from '@nestjs/common';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';

@Module({
  imports: [SetupModule],
  controllers: [PlatformController],
  providers: [PlatformService],
})
export class PlatformModule {}
