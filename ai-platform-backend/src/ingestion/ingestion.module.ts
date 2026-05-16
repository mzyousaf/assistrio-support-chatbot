import { DynamicModule, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Bot, BotSchema, ExtractJob, ExtractJobSchema, TrainJob, TrainJobSchema, TableImportJob, TableImportJobSchema, TableImportSession, TableImportSessionSchema } from '../models';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { RagModule } from '../rag/rag.module';
import { IngestionController } from './ingestion.controller';
import { JobsAutoRunController } from './jobs-auto-run.controller';
import { IngestionService } from './ingestion.service';
import { TableImportService } from './table-import.service';

@Module({})
export class IngestionModule {
  /**
   * @param registerHttpControllers When `false` (worker process), only `IngestionService` is registered — no `/api/jobs` routes.
   */
  static forRoot(options: { registerHttpControllers: boolean }): DynamicModule {
    return {
      module: IngestionModule,
      imports: [
        KnowledgeModule,
        RagModule,
        MongooseModule.forFeature([
          { name: Bot.name, schema: BotSchema },
          { name: ExtractJob.name, schema: ExtractJobSchema },
          { name: TrainJob.name, schema: TrainJobSchema },
          { name: TableImportJob.name, schema: TableImportJobSchema },
          { name: TableImportSession.name, schema: TableImportSessionSchema },
        ]),
      ],
      controllers: options.registerHttpControllers ? [IngestionController, JobsAutoRunController] : [],
      providers: [IngestionService, TableImportService],
      exports: [IngestionService, TableImportService],
    };
  }
}
