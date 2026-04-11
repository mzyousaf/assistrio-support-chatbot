import { apiDraftJsonToTrialWorkspaceDraftV3 } from "@/lib/trial/trial-draft-sync";
import { finalizeTrialProfile, type TrialWorkspaceDraftV3 } from "@/lib/trial/trial-workspace-draft";

/**
 * After upload/delete asset APIs return a full server draft snapshot, merge only the fields
 * owned by that action so newer unsaved local form state is preserved.
 */

/**
 * Applies server state for avatar: `profile` avatar sources + resolved `avatarUrl`, and `uploadedAssets` with `kind === 'avatar'`.
 */
export function mergeAvatarAssetServerResponseIntoDraft(
  local: TrialWorkspaceDraftV3,
  serverDraftRaw: unknown,
): TrialWorkspaceDraftV3 {
  const server = apiDraftJsonToTrialWorkspaceDraftV3(serverDraftRaw);
  const serverAvatarAssets = (server.uploadedAssets ?? []).filter((a) => a.kind === "avatar");
  const nonAvatarLocal = (local.uploadedAssets ?? []).filter((a) => a.kind !== "avatar");
  return {
    ...local,
    profile: finalizeTrialProfile({
      ...local.profile,
      avatarUrl: server.profile.avatarUrl,
      avatarByUpload: server.profile.avatarByUpload,
      avatarByUserURL: server.profile.avatarByUserURL,
    }),
    uploadedAssets: [...nonAvatarLocal, ...serverAvatarAssets],
  };
}

/**
 * Applies server state for knowledge documents only: `uploadedAssets` with `kind === 'knowledge_document'`.
 * Preserves local `knowledge` (snippet + Q&A sync on Go Live, not on upload).
 */
export function mergeKnowledgeDocumentAssetsServerResponseIntoDraft(
  local: TrialWorkspaceDraftV3,
  serverDraftRaw: unknown,
): TrialWorkspaceDraftV3 {
  const server = apiDraftJsonToTrialWorkspaceDraftV3(serverDraftRaw);
  const serverDocs = (server.uploadedAssets ?? []).filter((a) => a.kind === "knowledge_document");
  const nonDocLocal = (local.uploadedAssets ?? []).filter((a) => a.kind !== "knowledge_document");
  return {
    ...local,
    uploadedAssets: [...nonDocLocal, ...serverDocs],
    updatedAt: server.updatedAt,
  };
}

