import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Bot, BotSchema, FaqNoteEmbeddingJob, FaqNoteEmbeddingJobSchema } from '../models';
import { RagModule } from '../rag/rag.module';
import { FaqNoteEmbeddingJobService } from './faq-note-embedding-job.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Bot.name, schema: BotSchema },
      { name: FaqNoteEmbeddingJob.name, schema: FaqNoteEmbeddingJobSchema },
    ]),
    RagModule,
  ],
  providers: [FaqNoteEmbeddingJobService],
  exports: [FaqNoteEmbeddingJobService],
})
export class EmbeddingModule {}
