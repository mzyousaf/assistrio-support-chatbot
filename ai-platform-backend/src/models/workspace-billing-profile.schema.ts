import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true, collection: 'workspace_billing_profiles' })
export class WorkspaceBillingProfile {
  @Prop({ type: Types.ObjectId, ref: 'Workspace', required: true, unique: true, index: true })
  workspaceId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  address: string;

  @Prop({ required: true, trim: true })
  city: string;

  @Prop({ type: String, default: null, trim: true })
  state: string | null;

  @Prop({ required: true, trim: true })
  zipCode: string;

  @Prop({ required: true, trim: true, uppercase: true })
  country: string;

  @Prop({ type: String, default: null, trim: true })
  taxId: string | null;

  @Prop({ type: String, default: null, trim: true, lowercase: true })
  email: string | null;

  @Prop({ type: String, default: null, trim: true })
  notes: string | null;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  updatedBy: Types.ObjectId;
}

export type WorkspaceBillingProfileDocument = HydratedDocument<WorkspaceBillingProfile>;
export const WorkspaceBillingProfileSchema = SchemaFactory.createForClass(WorkspaceBillingProfile);
