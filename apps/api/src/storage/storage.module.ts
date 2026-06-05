import { Global, Module } from '@nestjs/common';
import { AttachmentsController } from './attachments.controller';
import { StorageService } from './storage.service';

@Global()
@Module({
  providers: [StorageService],
  controllers: [AttachmentsController],
  exports: [StorageService],
})
export class StorageModule {}
