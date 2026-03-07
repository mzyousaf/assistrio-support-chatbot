import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DocumentsService } from './documents.service';
import { Chunk, ChunkSchema, DocumentModel, DocumentSchema } from '../models';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DocumentModel.name, schema: DocumentSchema },
      { name: Chunk.name, schema: ChunkSchema },
    ]),
  ],
  controllers: [],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
