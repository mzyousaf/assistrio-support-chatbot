import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { CustomerSessionAuthGuard } from '../auth/customer/customer-session.guard';
import type { RequestUser } from '../auth/shared/request-user.types';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { WorkspaceOnboardingService } from '../workspaces/workspace-onboarding.service';
import { WorkspaceOnboardingGoLiveService } from './workspace-onboarding-go-live.service';
import { WorkspaceOnboardingKnowledgeStagingService } from '../workspaces/workspace-onboarding-knowledge-staging.service';
import { WorkspaceOnboardingKnowledgeContentService } from '../workspaces/workspace-onboarding-knowledge-content.service';
import { WorkspaceOnboardingDictationService } from '../workspaces/workspace-onboarding-dictation.service';
import {
  parseOnboardingQaBody,
  parseOnboardingQaPatchBody,
  parseOnboardingSnippetBody,
  parseOnboardingSnippetPatchBody,
} from '../workspaces/workspace-onboarding-knowledge-content.validation';
import {
  parseWorkspaceOnboardingGoLivePostBody,
} from '../workspaces/workspace-onboarding-go-live.validation';
import {
  parseWorkspaceOnboardingGoLivePatch,
  parseWorkspaceOnboardingInstructionsPatch,
  parseWorkspaceOnboardingKnowledgePatch,
  parseWorkspaceOnboardingProfilePatch,
  parseWorkspaceOnboardingProgressPatch,
} from '../workspaces/workspace-onboarding.validation';
import { parseOnboardingAvatarMultipart } from '../workspaces/workspace-onboarding-avatar.util';
import { parseOnboardingDocumentMultipart } from '../workspaces/workspace-onboarding-knowledge-multipart.util';
import { ONBOARDING_QA_IMPORT_SAMPLE_CSV } from '../workspaces/workspace-onboarding-qa-import.util';
import { ONBOARDING_SNIPPET_IMPORT_SAMPLE_CSV } from '../workspaces/workspace-onboarding-snippet-import.util';
import { readDatasheetFileFromMultipart } from './datasheet-import-request.util';
import { parseOnboardingKnowledgeBulkDeleteBody } from '../workspaces/workspace-onboarding-knowledge-bulk-delete.validation';
import type { WorkspaceOnboardingResponse } from '../workspaces/workspace-onboarding.types';

type RequestWithUser = FastifyRequest & { user?: RequestUser };

/**
 * Workspace-scoped onboarding draft APIs (Epic 3B).
 * Does not create Bot documents or KnowledgeBaseItem rows.
 */
@Controller('api/customer/workspaces')
@UseGuards(CustomerSessionAuthGuard)
export class CustomerWorkspaceOnboardingController {
  constructor(
    private readonly workspacesService: WorkspacesService,
    private readonly workspaceOnboardingService: WorkspaceOnboardingService,
    private readonly workspaceOnboardingGoLiveService: WorkspaceOnboardingGoLiveService,
    private readonly workspaceOnboardingKnowledgeStagingService: WorkspaceOnboardingKnowledgeStagingService,
    private readonly workspaceOnboardingKnowledgeContentService: WorkspaceOnboardingKnowledgeContentService,
    private readonly workspaceOnboardingDictationService: WorkspaceOnboardingDictationService,
  ) {}

  private async withStagedKnowledge(
    response: WorkspaceOnboardingResponse,
  ): Promise<WorkspaceOnboardingResponse> {
    return this.workspaceOnboardingKnowledgeStagingService.attachStagedKnowledgeToResponse(response);
  }

  private async assertWorkspaceMember(req: RequestWithUser, workspaceId: string): Promise<RequestUser> {
    const user = req.user;
    if (!user) {
      throw new ForbiddenException({ error: 'Customer session required.' });
    }

    const isMember = await this.workspacesService.isUserMemberOfWorkspace(String(user._id), workspaceId);
    if (!isMember) {
      throw new ForbiddenException({ error: 'Workspace access denied.' });
    }

    return user;
  }

  @Get(':workspaceId/onboarding')
  async getOnboarding(@Req() req: RequestWithUser, @Param('workspaceId') workspaceId: string) {
    await this.assertWorkspaceMember(req, workspaceId);
    const response = await this.workspaceOnboardingService.getOnboardingForWorkspace(workspaceId);
    return this.withStagedKnowledge(response);
  }

  @Patch(':workspaceId/onboarding/profile')
  async patchProfile(
    @Req() req: RequestWithUser,
    @Param('workspaceId') workspaceId: string,
    @Body() body: unknown,
  ) {
    await this.assertWorkspaceMember(req, workspaceId);
    const payload = parseWorkspaceOnboardingProfilePatch(body);
    const response = await this.workspaceOnboardingService.patchProfile(workspaceId, payload);
    return this.withStagedKnowledge(response);
  }

  @Patch(':workspaceId/onboarding/instructions')
  async patchInstructions(
    @Req() req: RequestWithUser,
    @Param('workspaceId') workspaceId: string,
    @Body() body: unknown,
  ) {
    await this.assertWorkspaceMember(req, workspaceId);
    const payload = parseWorkspaceOnboardingInstructionsPatch(body);
    const response = await this.workspaceOnboardingService.patchInstructions(workspaceId, payload);
    return this.withStagedKnowledge(response);
  }

  @Patch(':workspaceId/onboarding/knowledge')
  async patchKnowledge(
    @Req() req: RequestWithUser,
    @Param('workspaceId') workspaceId: string,
    @Body() body: unknown,
  ) {
    await this.assertWorkspaceMember(req, workspaceId);
    const payload = parseWorkspaceOnboardingKnowledgePatch(body);
    const response = await this.workspaceOnboardingService.patchKnowledge(workspaceId, payload);
    return this.withStagedKnowledge(response);
  }

  @Patch(':workspaceId/onboarding/go-live')
  async patchGoLive(
    @Req() req: RequestWithUser,
    @Param('workspaceId') workspaceId: string,
    @Body() body: unknown,
  ) {
    await this.assertWorkspaceMember(req, workspaceId);
    const payload = parseWorkspaceOnboardingGoLivePatch(body);
    const response = await this.workspaceOnboardingService.patchGoLive(workspaceId, payload);
    return this.withStagedKnowledge(response);
  }

  @Post(':workspaceId/onboarding/go-live')
  async postGoLive(
    @Req() req: RequestWithUser,
    @Param('workspaceId') workspaceId: string,
    @Body() body: unknown,
  ) {
    const user = await this.assertWorkspaceMember(req, workspaceId);
    const payload = parseWorkspaceOnboardingGoLivePostBody(body);
    return this.workspaceOnboardingGoLiveService.goLive(workspaceId, String(user._id), payload);
  }

  @Patch(':workspaceId/onboarding/progress')
  async patchProgress(
    @Req() req: RequestWithUser,
    @Param('workspaceId') workspaceId: string,
    @Body() body: unknown,
  ) {
    await this.assertWorkspaceMember(req, workspaceId);
    const payload = parseWorkspaceOnboardingProgressPatch(body);
    const response = await this.workspaceOnboardingService.patchProgress(workspaceId, payload);
    return this.withStagedKnowledge(response);
  }

  @Post(':workspaceId/onboarding/complete')
  async postComplete(@Req() req: RequestWithUser, @Param('workspaceId') workspaceId: string) {
    await this.assertWorkspaceMember(req, workspaceId);
    return this.workspaceOnboardingService.completeOnboarding(workspaceId);
  }

  @Post(':workspaceId/onboarding/avatar')
  async postAvatar(@Req() req: RequestWithUser, @Param('workspaceId') workspaceId: string) {
    await this.assertWorkspaceMember(req, workspaceId);
    const file = await parseOnboardingAvatarMultipart(req);
    const response = await this.workspaceOnboardingService.uploadAvatar(workspaceId, file);
    return this.withStagedKnowledge(response);
  }

  @Post(':workspaceId/onboarding/knowledge/documents')
  async postKnowledgeDocuments(@Req() req: RequestWithUser, @Param('workspaceId') workspaceId: string) {
    await this.assertWorkspaceMember(req, workspaceId);
    const files = await parseOnboardingDocumentMultipart(req);
    return this.workspaceOnboardingKnowledgeStagingService.uploadDocuments(workspaceId, files);
  }

  @Get(':workspaceId/onboarding/knowledge/documents')
  async getKnowledgeDocuments(@Req() req: RequestWithUser, @Param('workspaceId') workspaceId: string) {
    await this.assertWorkspaceMember(req, workspaceId);
    const onboarding = await this.workspaceOnboardingService.getOnboardingForWorkspace(workspaceId);
    const draftId = onboarding.onboardingDraftId;
    const documents = draftId
      ? (await this.workspaceOnboardingKnowledgeStagingService.listStagedKnowledge(draftId)).documents
      : [];
    return { documents };
  }

  @Delete(':workspaceId/onboarding/knowledge/documents/:stagedItemId')
  async deleteKnowledgeDocument(
    @Req() req: RequestWithUser,
    @Param('workspaceId') workspaceId: string,
    @Param('stagedItemId') stagedItemId: string,
  ) {
    await this.assertWorkspaceMember(req, workspaceId);
    return this.workspaceOnboardingKnowledgeStagingService.deleteStagedItem(
      workspaceId,
      stagedItemId,
      'document',
    );
  }

  @Post(':workspaceId/onboarding/knowledge/documents/bulk-delete')
  async bulkDeleteKnowledgeDocuments(
    @Req() req: RequestWithUser,
    @Param('workspaceId') workspaceId: string,
    @Body() body: unknown,
  ) {
    await this.assertWorkspaceMember(req, workspaceId);
    const ids = parseOnboardingKnowledgeBulkDeleteBody(body);
    return this.workspaceOnboardingKnowledgeStagingService.bulkDeleteStagedItems(
      workspaceId,
      ids,
      'document',
    );
  }

  @Post(':workspaceId/onboarding/knowledge/datasheets')
  async postKnowledgeDatasheets(@Req() req: RequestWithUser, @Param('workspaceId') workspaceId: string) {
    await this.assertWorkspaceMember(req, workspaceId);
    const file = await readDatasheetFileFromMultipart(req as never, () => undefined);
    return this.workspaceOnboardingKnowledgeStagingService.uploadDatasheet(workspaceId, file);
  }

  @Get(':workspaceId/onboarding/knowledge/datasheets')
  async getKnowledgeDatasheets(@Req() req: RequestWithUser, @Param('workspaceId') workspaceId: string) {
    await this.assertWorkspaceMember(req, workspaceId);
    const onboarding = await this.workspaceOnboardingService.getOnboardingForWorkspace(workspaceId);
    const draftId = onboarding.onboardingDraftId;
    const datasheets = draftId
      ? (await this.workspaceOnboardingKnowledgeStagingService.listStagedKnowledge(draftId)).datasheets
      : [];
    return { datasheets };
  }

  @Delete(':workspaceId/onboarding/knowledge/datasheets/:stagedItemId')
  async deleteKnowledgeDatasheet(
    @Req() req: RequestWithUser,
    @Param('workspaceId') workspaceId: string,
    @Param('stagedItemId') stagedItemId: string,
  ) {
    await this.assertWorkspaceMember(req, workspaceId);
    return this.workspaceOnboardingKnowledgeStagingService.deleteStagedItem(
      workspaceId,
      stagedItemId,
      'datasheet',
    );
  }

  @Post(':workspaceId/onboarding/knowledge/datasheets/bulk-delete')
  async bulkDeleteKnowledgeDatasheets(
    @Req() req: RequestWithUser,
    @Param('workspaceId') workspaceId: string,
    @Body() body: unknown,
  ) {
    await this.assertWorkspaceMember(req, workspaceId);
    const ids = parseOnboardingKnowledgeBulkDeleteBody(body);
    return this.workspaceOnboardingKnowledgeStagingService.bulkDeleteStagedItems(
      workspaceId,
      ids,
      'datasheet',
    );
  }

  @Get(':workspaceId/onboarding/knowledge/snippets')
  async getSnippets(@Req() req: RequestWithUser, @Param('workspaceId') workspaceId: string) {
    await this.assertWorkspaceMember(req, workspaceId);
    return this.workspaceOnboardingKnowledgeContentService.listSnippets(workspaceId);
  }

  @Post(':workspaceId/onboarding/knowledge/snippets')
  async postSnippet(
    @Req() req: RequestWithUser,
    @Param('workspaceId') workspaceId: string,
    @Body() body: unknown,
  ) {
    await this.assertWorkspaceMember(req, workspaceId);
    const payload = parseOnboardingSnippetBody(body);
    return this.workspaceOnboardingKnowledgeContentService.createSnippet(workspaceId, payload);
  }

  @Patch(':workspaceId/onboarding/knowledge/snippets/:snippetId')
  async patchSnippet(
    @Req() req: RequestWithUser,
    @Param('workspaceId') workspaceId: string,
    @Param('snippetId') snippetId: string,
    @Body() body: unknown,
  ) {
    await this.assertWorkspaceMember(req, workspaceId);
    const payload = parseOnboardingSnippetPatchBody(body);
    return this.workspaceOnboardingKnowledgeContentService.updateSnippet(workspaceId, snippetId, payload);
  }

  @Delete(':workspaceId/onboarding/knowledge/snippets/:snippetId')
  async deleteSnippet(
    @Req() req: RequestWithUser,
    @Param('workspaceId') workspaceId: string,
    @Param('snippetId') snippetId: string,
  ) {
    await this.assertWorkspaceMember(req, workspaceId);
    return this.workspaceOnboardingKnowledgeContentService.deleteSnippet(workspaceId, snippetId);
  }

  @Post(':workspaceId/onboarding/knowledge/snippets/bulk-delete')
  async bulkDeleteSnippets(
    @Req() req: RequestWithUser,
    @Param('workspaceId') workspaceId: string,
    @Body() body: unknown,
  ) {
    await this.assertWorkspaceMember(req, workspaceId);
    const ids = parseOnboardingKnowledgeBulkDeleteBody(body);
    return this.workspaceOnboardingKnowledgeContentService.bulkDeleteSnippets(workspaceId, ids);
  }

  @Get(':workspaceId/onboarding/knowledge/snippets/import-csv-sample')
  getSnippetImportCsvSample() {
    return {
      fileName: 'assistrio-snippets-sample.csv',
      content: ONBOARDING_SNIPPET_IMPORT_SAMPLE_CSV,
    };
  }

  @Post(':workspaceId/onboarding/knowledge/snippets/import')
  async importSnippets(@Req() req: RequestWithUser, @Param('workspaceId') workspaceId: string) {
    await this.assertWorkspaceMember(req, workspaceId);
    return this.workspaceOnboardingKnowledgeContentService.importSnippets(workspaceId, req);
  }

  @Get(':workspaceId/onboarding/knowledge/qas')
  async getQas(@Req() req: RequestWithUser, @Param('workspaceId') workspaceId: string) {
    await this.assertWorkspaceMember(req, workspaceId);
    return this.workspaceOnboardingKnowledgeContentService.listQas(workspaceId);
  }

  @Post(':workspaceId/onboarding/knowledge/qas')
  async postQa(
    @Req() req: RequestWithUser,
    @Param('workspaceId') workspaceId: string,
    @Body() body: unknown,
  ) {
    await this.assertWorkspaceMember(req, workspaceId);
    const payload = parseOnboardingQaBody(body);
    return this.workspaceOnboardingKnowledgeContentService.createQa(workspaceId, payload);
  }

  @Patch(':workspaceId/onboarding/knowledge/qas/:qaId')
  async patchQa(
    @Req() req: RequestWithUser,
    @Param('workspaceId') workspaceId: string,
    @Param('qaId') qaId: string,
    @Body() body: unknown,
  ) {
    await this.assertWorkspaceMember(req, workspaceId);
    const payload = parseOnboardingQaPatchBody(body);
    return this.workspaceOnboardingKnowledgeContentService.updateQa(workspaceId, qaId, payload);
  }

  @Delete(':workspaceId/onboarding/knowledge/qas/:qaId')
  async deleteQa(
    @Req() req: RequestWithUser,
    @Param('workspaceId') workspaceId: string,
    @Param('qaId') qaId: string,
  ) {
    await this.assertWorkspaceMember(req, workspaceId);
    return this.workspaceOnboardingKnowledgeContentService.deleteQa(workspaceId, qaId);
  }

  @Post(':workspaceId/onboarding/knowledge/qas/bulk-delete')
  async bulkDeleteQas(
    @Req() req: RequestWithUser,
    @Param('workspaceId') workspaceId: string,
    @Body() body: unknown,
  ) {
    await this.assertWorkspaceMember(req, workspaceId);
    const ids = parseOnboardingKnowledgeBulkDeleteBody(body);
    return this.workspaceOnboardingKnowledgeContentService.bulkDeleteQas(workspaceId, ids);
  }

  @Get(':workspaceId/onboarding/knowledge/qas/import-csv-sample')
  getQaImportCsvSample() {
    return {
      fileName: 'qa-import-sample.csv',
      content: ONBOARDING_QA_IMPORT_SAMPLE_CSV,
    };
  }

  @Post(':workspaceId/onboarding/knowledge/qas/import')
  async importQas(@Req() req: RequestWithUser, @Param('workspaceId') workspaceId: string) {
    await this.assertWorkspaceMember(req, workspaceId);
    return this.workspaceOnboardingKnowledgeContentService.importQas(workspaceId, req);
  }

  @Post(':workspaceId/onboarding/dictation/describe-agent')
  async transcribeDescribeAgent(@Req() req: RequestWithUser, @Param('workspaceId') workspaceId: string) {
    await this.assertWorkspaceMember(req, workspaceId);
    return this.workspaceOnboardingDictationService.transcribeDescribeAgent(req);
  }
}
