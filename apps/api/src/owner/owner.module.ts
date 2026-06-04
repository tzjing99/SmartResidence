import { Module } from '@nestjs/common';
import { OwnerController } from './owner.controller';
import { AuthModule } from '@/auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [OwnerController],
})
export class OwnerModule {}
