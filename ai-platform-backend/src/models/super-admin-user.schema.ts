import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ timestamps: false })
export class SuperAdminUser {
  @Prop({ required: true, unique: true, lowercase: true })
  email: string;
  @Prop({ required: true })
  passwordHash: string;
  @Prop({ default: 'superadmin', enum: ['superadmin'] })
  role: string;
  @Prop({ default: Date.now })
  createdAt: Date;
}

export const SuperAdminUserSchema = SchemaFactory.createForClass(SuperAdminUser);
