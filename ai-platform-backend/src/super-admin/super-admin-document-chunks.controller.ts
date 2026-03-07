import { Controller, Get, HttpException, HttpStatus, Param, UseGuards } from '@nestjs/common';
import { Types } from 'mongoose';
import { DocumentsService } from '../documents/documents.service';
import { SuperAdminGuard } from './super-admin.guard';

@Controller('api/super-admin')
@UseGuards(SuperAdminGuard)
export class SuperAdminDocumentChunksController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get('documents/:docId/chunks-count')
  async getChunksCount(@Param('docId') docId: string): Promise<{ count: number }> {
    if (!Types.ObjectId.isValid(docId)) {
      throw new HttpException({ error: 'Invalid document id' }, HttpStatus.BAD_REQUEST);
    }
    const count = await this.documentsService.countChunksByDocumentId(docId);
    return { count };
  }
}
