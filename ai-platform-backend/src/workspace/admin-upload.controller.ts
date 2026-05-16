import { Controller, HttpException, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { AdminSessionAuthGuard } from '../auth/admin/admin-session.guard';
import { SuperAdminGuard } from '../auth/admin/super-admin.guard';
import type { RequestUser } from '../auth/shared/request-user.types';
import { OperatorWorkspaceUploadService } from './shared/operator-workspace-upload.service';

type RequestWithUser = FastifyRequest & { user?: RequestUser };

@Controller('api/admin/upload')
@UseGuards(AdminSessionAuthGuard, SuperAdminGuard)
export class AdminUploadController {
  constructor(private readonly operatorUploadService: OperatorWorkspaceUploadService) {}

  @Post()
  async upload(@Req() req: RequestWithUser) {
    const user = req.user;
    if (!user) {
      throw new HttpException({ error: 'Unauthorized' }, HttpStatus.UNAUTHORIZED);
    }
    return this.operatorUploadService.processMultipartOperatorUpload(req);
  }
}
