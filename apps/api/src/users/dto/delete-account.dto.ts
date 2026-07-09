import { ApiProperty } from '@nestjs/swagger';
import { Equals, IsString } from 'class-validator';

/** Exact confirmation phrase required to delete / anonymize an account. */
export const ACCOUNT_DELETE_CONFIRMATION = 'DELETE MY ACCOUNT';

export class DeleteAccountDto {
  @ApiProperty({
    description: `Type "${ACCOUNT_DELETE_CONFIRMATION}" to confirm irreversible account deletion.`,
    example: ACCOUNT_DELETE_CONFIRMATION,
  })
  @IsString()
  @Equals(ACCOUNT_DELETE_CONFIRMATION, {
    message: `confirmation must be exactly "${ACCOUNT_DELETE_CONFIRMATION}"`,
  })
  confirmation!: string;
}
