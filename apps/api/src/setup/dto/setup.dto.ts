import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SETUP_STEP_ORDER, type SetupStepKey } from '@smartresidence/shared-types';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';

export class UpdateSetupStepDto {
  @ApiProperty({ enum: SETUP_STEP_ORDER, description: 'Which wizard step to update' })
  @IsIn(SETUP_STEP_ORDER)
  step!: SetupStepKey;

  @ApiPropertyOptional({ description: 'Mark the step as done' })
  @IsOptional()
  @IsBoolean()
  done?: boolean;

  @ApiPropertyOptional({ description: 'Mark the step as skipped/deferred' })
  @IsOptional()
  @IsBoolean()
  skipped?: boolean;
}
