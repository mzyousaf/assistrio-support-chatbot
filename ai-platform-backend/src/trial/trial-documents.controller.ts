import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Query,
} from '@nestjs/common';
import { BotsService } from '../bots/bots.service';
import { DocumentsService } from '../documents/documents.service';
import { Types } from 'mongoose';

@Controller('api/trial/bots')
export class TrialDocumentsController {
  constructor(
    private readonly botsService: BotsService,
    private readonly documentsService: DocumentsService,
  ) {}

  @Get(':id/documents')
  async listDocuments(
    @Param('id') id: string,
    @Query('visitorId') visitorId: string | undefined,
  ) {
    if (!Types.ObjectId.isValid(id) || !visitorId?.trim()) {
      throw new HttpException(
        { error: 'Invalid request' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const bot = await this.botsService.findOneForOwnership(id);
    if (!bot || (bot as { type?: string }).type !== 'visitor-own') {
      throw new HttpException({ error: 'Bot not found' }, HttpStatus.NOT_FOUND);
    }

    const ownerId = String((bot as { ownerVisitorId?: unknown }).ownerVisitorId ?? '');
    if (ownerId !== visitorId.trim()) {
      throw new HttpException({ error: 'Unauthorized' }, HttpStatus.UNAUTHORIZED);
    }

    const documents = await this.documentsService.findByBot(id);

    return {
      ok: true,
      documents: documents.map((doc: Record<string, unknown>) => ({
        docId: String(doc._id),
        fileName: doc.fileName ?? undefined,
        status: doc.status ?? 'queued',
        error: doc.error ?? undefined,
        ingestedAt: doc.ingestedAt
          ? new Date(doc.ingestedAt as Date).toISOString()
          : undefined,
      })),
    };
  }
}
