import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import type { AuthenticatedUser } from '@/common/types/request-context';
import { Body, Controller, Get, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';
import { PushKind } from '@prisma/client';
import {
  IsArray,
  IsBooleanString,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { NotificationService } from './notification.service';

class RegisterPushDto {
  @ApiProperty({ enum: PushKind })
  @IsEnum(PushKind)
  kind!: PushKind;

  @ApiProperty()
  @IsString()
  token!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  deviceInfo?: Record<string, unknown>;
}

class MarkReadDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID(undefined, { each: true })
  ids!: string[];
}

class ListNotificationsDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBooleanString()
  unreadOnly?: string;
}

@ApiTags('Notifications')
@ApiBearerAuth('access')
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListNotificationsDto) {
    return this.notifications.list(user.id, {
      ...query,
      unreadOnly: query.unreadOnly === 'true',
    });
  }

  @Patch('read')
  read(@CurrentUser() user: AuthenticatedUser, @Body() dto: MarkReadDto) {
    return this.notifications.markRead(user.id, dto.ids);
  }

  @Post('push-tokens')
  registerPush(@CurrentUser() user: AuthenticatedUser, @Body() dto: RegisterPushDto) {
    return this.notifications.registerPushToken({ userId: user.id, ...dto });
  }
}
