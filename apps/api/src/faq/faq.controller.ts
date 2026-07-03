import { CheckAbility } from '@/auth/abilities/check-ability.decorator';
import { Audit } from '@/common/decorators/audit.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@/common/types/request-context';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';
import { DeflectMatchDto } from './dto/deflect.dto';
import {
  CreateFaqArticleDto,
  CreateFaqCategoryDto,
  ListFaqDto,
  UpdateFaqArticleDto,
  UpdateFaqCategoryDto,
} from './dto/faq.dto';
import { FaqService } from './faq.service';

@ApiTags('FAQ')
@ApiBearerAuth('access')
@Controller('faq')
export class FaqController {
  constructor(private readonly faq: FaqService) {}

  // -- resident-facing ----------------------------------------------

  @Get('condo/:condoId')
  @CheckAbility({ action: 'read', subject: 'Faq' })
  listPublished(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Query() query: ListFaqDto,
  ) {
    return this.faq.listPublished(user, condoId, query);
  }

  @Get('condo/:condoId/categories')
  @CheckAbility({ action: 'read', subject: 'Faq' })
  listCategories(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
  ) {
    return this.faq.listCategories(user, condoId);
  }

  @Get('condo/:condoId/manage')
  @CheckAbility({ action: 'manage', subject: 'Faq' })
  listAll(
    @CurrentUser() user: AuthenticatedUser,
    @Param('condoId', new ParseUUIDPipe()) condoId: string,
    @Query() query: ListFaqDto,
  ) {
    return this.faq.listAll(user, condoId, query);
  }

  @Get('articles/:id')
  @CheckAbility({ action: 'read', subject: 'Faq' })
  getArticle(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.faq.getArticle(user, id, { countView: true });
  }

  @Post('articles/:id/helpful')
  @CheckAbility({ action: 'read', subject: 'Faq' })
  markHelpful(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.faq.markHelpful(user, id);
  }

  @Post('deflect-match')
  @CheckAbility({ action: 'read', subject: 'Faq' })
  deflectMatch(@CurrentUser() user: AuthenticatedUser, @Body() dto: DeflectMatchDto) {
    return this.faq.matchForDeflection(user, dto.condoId, dto.subject, dto.body);
  }

  // -- management CRUD ----------------------------------------------

  @Post('categories')
  @CheckAbility({ action: 'manage', subject: 'Faq' })
  createCategory(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateFaqCategoryDto) {
    return this.faq.createCategory(user, dto);
  }

  @Patch('categories/:id')
  @CheckAbility({ action: 'manage', subject: 'Faq' })
  updateCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateFaqCategoryDto,
  ) {
    return this.faq.updateCategory(user, id, dto);
  }

  @Delete('categories/:id')
  @CheckAbility({ action: 'manage', subject: 'Faq' })
  deleteCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.faq.deleteCategory(user, id);
  }

  @Post('articles')
  @CheckAbility({ action: 'manage', subject: 'Faq' })
  @Audit({ action: AuditAction.CREATE, resourceType: 'FaqArticle', resourceIdFrom: 'response.id' })
  createArticle(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateFaqArticleDto) {
    return this.faq.createArticle(user, dto);
  }

  @Patch('articles/:id')
  @CheckAbility({ action: 'manage', subject: 'Faq' })
  updateArticle(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateFaqArticleDto,
  ) {
    return this.faq.updateArticle(user, id, dto);
  }

  @Delete('articles/:id')
  @CheckAbility({ action: 'manage', subject: 'Faq' })
  deleteArticle(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.faq.deleteArticle(user, id);
  }
}
