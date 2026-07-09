import { Module } from '@nestjs/common';
import { UserAccountDeletionService } from './user-account-deletion.service';
import { UserDataExportService } from './user-data-export.service';
import { UsersController } from './users.controller';

@Module({
  providers: [UserDataExportService, UserAccountDeletionService],
  controllers: [UsersController],
})
export class UsersModule {}
