import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ timestamps: false, collection: 'workspaces' })
export class Workspace {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ default: Date.now })
  createdAt: Date;
}

export const WorkspaceSchema = SchemaFactory.createForClass(Workspace);
WorkspaceSchema.index({ createdAt: -1 });
