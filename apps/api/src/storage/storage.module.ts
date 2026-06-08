import { Global, Module } from '@nestjs/common';
import { AttachmentCleanupService } from './attachment-cleanup.service';
import { AttachmentsController } from './attachments.controller';
import { ImageService } from './image.service';
import { StorageService } from './storage.service';
import { UploadsController } from './uploads.controller';

@Global()
@Module({
  providers: [StorageService, ImageService, AttachmentCleanupService],
  controllers: [AttachmentsController, UploadsController],
  exports: [StorageService],
})
export class StorageModule {}
