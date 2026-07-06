import { Module } from '@nestjs/common';
import { UserDataExportService } from './user-data-export.service';
import { UsersController } from './users.controller';

@Module({
  providers: [UserDataExportService],
  controllers: [UsersController],
})
export class UsersModule {}
