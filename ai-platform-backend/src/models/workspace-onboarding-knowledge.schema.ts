import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: false })
export class WorkspaceOnboardingDraftSnippet {
  @Prop({ required: true, trim: true })
  id!: string;

  @Prop({ trim: true, default: '' })
  title?: string;

  @Prop({ trim: true, default: '' })
  description?: string;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;

  /** Monotonic create order — higher = newer. */
  @Prop()
  sequence?: number;

  /** Monotonic last-touch order — higher = more recently edited. */
  @Prop()
  updateSequence?: number;
}

@Schema({ _id: false })
export class WorkspaceOnboardingDraftQa {
  @Prop({ required: true, trim: true })
  id!: string;

  @Prop({ trim: true, default: '' })
  title?: string;

  @Prop({ type: [String], default: [] })
  questions?: string[];

  @Prop({ trim: true, default: '' })
  answer?: string;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;

  /** Monotonic create order — higher = newer. */
  @Prop()
  sequence?: number;

  /** Monotonic last-touch order — higher = more recently edited. */
  @Prop()
  updateSequence?: number;
}

/** @deprecated Legacy single-question FAQ row — migrated to {@link WorkspaceOnboardingDraftQa} on read. */
@Schema({ _id: false })
export class WorkspaceOnboardingDraftFaq {
  @Prop({ trim: true, default: '' })
  question?: string;

  @Prop({ trim: true, default: '' })
  answer?: string;
}
