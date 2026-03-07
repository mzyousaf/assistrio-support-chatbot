import { Controller, Get, Delete, Param } from '@nestjs/common';
import { DocumentsService } from './documents.service';

/**
 * Documents controller (list/delete). Document upload is handled by
 * SuperAdminDocumentsController: POST /api/super-admin/bots/:id/upload-doc
 * (creates Document + IngestJob, uses shared uploadToS3).
 */
@Controller('api/super-admin/bots/:botId/documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  list(@Param('botId') botId: string) {
    return this.documentsService.findByBot(botId);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.documentsService.remove(id);
  }
}
