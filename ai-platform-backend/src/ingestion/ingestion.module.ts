import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DocumentModel, DocumentSchema, IngestJob, IngestJobSchema } from '../models';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { RagModule } from '../rag/rag.module';
import { IngestionController } from './ingestion.controller';
import { JobsAutoRunController } from './jobs-auto-run.controller';
import { IngestionService } from './ingestion.service';

@Module({
  imports: [
    KnowledgeModule,
    RagModule,
    MongooseModule.forFeature([
      { name: DocumentModel.name, schema: DocumentSchema },
      { name: IngestJob.name, schema: IngestJobSchema },
    ]),
  ],
  controllers: [IngestionController, JobsAutoRunController],
  providers: [IngestionService],
  exports: [IngestionService],
})
export class IngestionModule { }
