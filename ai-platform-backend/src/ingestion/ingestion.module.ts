import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Chunk, ChunkSchema, DocumentModel, DocumentSchema, IngestJob, IngestJobSchema } from '../models';
import { KbModule } from '../kb/kb.module';
import { IngestionController } from './ingestion.controller';
import { JobsAutoRunController } from './jobs-auto-run.controller';
import { IngestionService } from './ingestion.service';

@Module({
  imports: [
    KbModule,
    MongooseModule.forFeature([
      { name: DocumentModel.name, schema: DocumentSchema },
      { name: IngestJob.name, schema: IngestJobSchema },
      { name: Chunk.name, schema: ChunkSchema },
    ]),
  ],
  controllers: [IngestionController, JobsAutoRunController],
  providers: [IngestionService],
  exports: [IngestionService],
})
export class IngestionModule {}
