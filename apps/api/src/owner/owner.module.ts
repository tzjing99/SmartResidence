import { AuthModule } from '@/auth/auth.module';
import { Module } from '@nestjs/common';
import { OwnerController } from './owner.controller';

@Module({
  imports: [AuthModule],
  controllers: [OwnerController],
})
export class OwnerModule {}
