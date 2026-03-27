import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DocumentsService } from './documents.service';
import { DocumentModel, DocumentSchema } from '../models';
import { KnowledgeModule } from '../knowledge/knowledge.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: DocumentModel.name, schema: DocumentSchema }]),
    KnowledgeModule,
  ],
  controllers: [],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule { }
