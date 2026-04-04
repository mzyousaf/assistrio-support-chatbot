import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

export type VisitorEventType =
  | 'page_view'
  | 'demo_chat_started'
  | 'trial_bot_created'
  | 'trial_chat_started'
  /** Landing / marketing (assistrio-landing-site) — details in `metadata` */
  | 'cta_clicked'
  | 'demo_opened'
  | 'trial_create_started'
  | 'trial_create_succeeded'
  | 'snippet_copied'
  | 'stable_id_copied'
  | 'reconnect_submitted'
  | 'reconnect_succeeded'
  | 'website_register_started'
  | 'website_register_succeeded'
  | 'widget_runtime_opened'
  | 'quota_viewed';

const VISITOR_EVENT_ENUM: VisitorEventType[] = [
  'page_view',
  'demo_chat_started',
  'trial_bot_created',
  'trial_chat_started',
  'cta_clicked',
  'demo_opened',
  'trial_create_started',
  'trial_create_succeeded',
  'snippet_copied',
  'stable_id_copied',
  'reconnect_submitted',
  'reconnect_succeeded',
  'website_register_started',
  'website_register_succeeded',
  'widget_runtime_opened',
  'quota_viewed',
];

@Schema({ timestamps: false })
export class VisitorEvent {
  @Prop({ required: true })
  visitorId: string;
  @Prop({
    required: true,
    enum: VISITOR_EVENT_ENUM,
  })
  type: VisitorEventType;
  @Prop()
  path?: string;
  @Prop()
  botSlug?: string;
  @Prop({ type: Types.ObjectId, ref: 'Bot' })
  botId?: Types.ObjectId;
  @Prop({ type: Object })
  metadata?: Record<string, unknown>;
  @Prop({ default: () => new Date() })
  createdAt: Date;
}

export const VisitorEventSchema = SchemaFactory.createForClass(VisitorEvent);
VisitorEventSchema.index({ visitorId: 1 });
VisitorEventSchema.index({ type: 1 });
VisitorEventSchema.index({ botSlug: 1 });
VisitorEventSchema.index({ visitorId: 1, createdAt: -1 });
VisitorEventSchema.index({ type: 1, createdAt: -1 });
