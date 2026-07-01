import { Module } from '@nestjs/common';
import { FormSubmissionController, FormTemplateController } from './forms.controller';
import { FormsService } from './forms.service';

@Module({
  providers: [FormsService],
  controllers: [FormTemplateController, FormSubmissionController],
  exports: [FormsService],
})
export class FormsModule {}
