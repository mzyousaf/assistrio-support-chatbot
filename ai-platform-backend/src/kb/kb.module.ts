import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Chunk, ChunkSchema } from '../models';
import { RagModule } from '../rag/rag.module';
import { KbService } from './kb.service';

@Module({
  imports: [
    RagModule,
    MongooseModule.forFeature([{ name: Chunk.name, schema: ChunkSchema }]),
  ],
  providers: [KbService],
  exports: [KbService],
})
export class KbModule {}
