import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/** Per–UI-bucket aggregate (snippets, qna, documents, datasheets, suggestions). */
@Schema({ _id: false })
export class BotKnowledgeTypeStats {
  @Prop({ default: 0 })
  items: number;
  @Prop({ default: 0 })
  characters: number;
  /** Populated for datasheets (table rows). Other buckets keep 0. */
  @Prop({ default: 0 })
  rows: number;
}

@Schema({ _id: false })
export class BotKnowledgeStatsByType {
  @Prop({ type: BotKnowledgeTypeStats, default: () => ({ items: 0, characters: 0, rows: 0 }) })
  snippets: BotKnowledgeTypeStats;
  @Prop({ type: BotKnowledgeTypeStats, default: () => ({ items: 0, characters: 0, rows: 0 }) })
  qna: BotKnowledgeTypeStats;
  @Prop({ type: BotKnowledgeTypeStats, default: () => ({ items: 0, characters: 0, rows: 0 }) })
  documents: BotKnowledgeTypeStats;
  @Prop({ type: BotKnowledgeTypeStats, default: () => ({ items: 0, characters: 0, rows: 0 }) })
  datasheets: BotKnowledgeTypeStats;
  @Prop({ type: BotKnowledgeTypeStats, default: () => ({ items: 0, characters: 0, rows: 0 }) })
  suggestions: BotKnowledgeTypeStats;
}

@Schema({ _id: false })
export class BotKnowledgeStats {
  @Prop({ default: 0 })
  totalCharacters: number;
  @Prop({ default: 0 })
  totalItems: number;

  @Prop({ default: 0 })
  readyCharacters: number;
  @Prop({ default: 0 })
  pendingCharacters: number;
  @Prop({ default: 0 })
  queuedCharacters: number;
  @Prop({ default: 0 })
  processingCharacters: number;
  @Prop({ default: 0 })
  failedCharacters: number;
  @Prop({ default: 0 })
  uiOnlyCharacters: number;

  @Prop({ default: 0 })
  readyItems: number;
  @Prop({ default: 0 })
  pendingItems: number;
  @Prop({ default: 0 })
  queuedItems: number;
  @Prop({ default: 0 })
  processingItems: number;
  @Prop({ default: 0 })
  failedItems: number;
  @Prop({ default: 0 })
  uiOnlyItems: number;

  @Prop({ type: BotKnowledgeStatsByType, default: () => ({}) })
  byType: BotKnowledgeStatsByType;

  @Prop()
  lastUpdatedAt?: Date;
  @Prop()
  lastQueuedAt?: Date;
  @Prop()
  lastTrainingStartedAt?: Date;
  @Prop()
  lastTrainedAt?: Date;
}

@Schema({ _id: false })
export class BotKnowledgeTrainingSettings {
  /** Default off (matches app bootstrap). Bots omitting `knowledgeTraining` still resolve legacy behavior in `getKnowledgeTrainingSettings`. */
  @Prop({ default: false })
  autoTrainEnabled: boolean;
  @Prop({ default: 5, min: 0 })
  trainingDelayMinutes: number;
  /** `smart` = per-type delays after first successful training; `fixed` = always use `trainingDelayMinutes`. */
  @Prop({ enum: ['smart', 'fixed'], default: 'smart' })
  scheduleMode?: 'smart' | 'fixed';
}

export const BotKnowledgeTypeStatsSchema = SchemaFactory.createForClass(BotKnowledgeTypeStats);
export const BotKnowledgeStatsByTypeSchema = SchemaFactory.createForClass(BotKnowledgeStatsByType);
export const BotKnowledgeStatsSchema = SchemaFactory.createForClass(BotKnowledgeStats);
export const BotKnowledgeTrainingSettingsSchema = SchemaFactory.createForClass(BotKnowledgeTrainingSettings);
