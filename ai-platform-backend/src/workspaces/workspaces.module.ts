import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema, Workspace, WorkspaceSchema, WorkspaceMembership, WorkspaceMembershipSchema } from '../models';
import { WorkspacesService } from './workspaces.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Workspace.name, schema: WorkspaceSchema },
      { name: WorkspaceMembership.name, schema: WorkspaceMembershipSchema },
    ]),
  ],
  providers: [WorkspacesService],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}
