import { Module } from '@nestjs/common';
import {
  DocumentController,
  DocumentFolderController,
  DocumentVersionController,
} from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  providers: [DocumentsService],
  controllers: [DocumentFolderController, DocumentController, DocumentVersionController],
  exports: [DocumentsService],
})
export class DocumentsModule {}
