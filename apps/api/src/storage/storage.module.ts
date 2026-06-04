import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { AttachmentsController } from './attachments.controller';

@Global()
@Module({
  providers: [StorageService],
  controllers: [AttachmentsController],
  exports: [StorageService],
})
export class StorageModule {}
