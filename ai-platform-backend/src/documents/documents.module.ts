import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DocumentsService } from './documents.service';
import { ExtractJob, ExtractJobSchema, TrainJob, TrainJobSchema } from '../models';
import { KnowledgeModule } from '../knowledge/knowledge.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ExtractJob.name, schema: ExtractJobSchema },
      { name: TrainJob.name, schema: TrainJobSchema },
    ]),
    KnowledgeModule,
  ],
  controllers: [],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule { }
