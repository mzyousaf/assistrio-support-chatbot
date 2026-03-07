import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Chunk, ChunkSchema } from '../models';
import { RagService } from './rag.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Chunk.name, schema: ChunkSchema }]),
  ],
  providers: [RagService],
  exports: [RagService],
})
export class RagModule {}
