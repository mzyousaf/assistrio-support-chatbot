/**
 * Copy customer knowledge UI into admin app with API/workspace renames.
 * Run: node scripts/port-knowledge-phase6.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const customerRoot = path.join(root, '..', 'assistrio-customer-app', 'src');

const copies = [
  ['pages/bot-workspace/knowledge', 'pages/bot-workspace/knowledge'],
  ['pages/bot-workspace/KnowledgeSection.tsx', 'pages/bot-workspace/KnowledgeSection.tsx'],
  ['pages/bot-workspace/components/NeedsTrainingModal.tsx', 'pages/bot-workspace/components/NeedsTrainingModal.tsx'],
  ['pages/bot-workspace/components/KnowledgeSourcesModal.tsx', 'pages/bot-workspace/components/KnowledgeSourcesModal.tsx'],
  ['context/KbWorkspacePollingContext.tsx', 'context/KbWorkspacePollingContext.tsx'],
  ['context/KnowledgeStorageUxContext.tsx', 'context/KnowledgeStorageUxContext.tsx'],
  ['components/knowledge', 'components/knowledge'],
  ['lib/customerKnowledgeItemDelete.ts', 'lib/adminKnowledgeItemDelete.ts'],
  ['lib/knowledgeOverviewSources.ts', 'lib/knowledgeOverviewSources.ts'],
  ['lib/knowledgeReplyPriority.ts', 'lib/knowledgeReplyPriority.ts'],
  ['lib/knowledgeReplyPrioritySection.ts', 'lib/knowledgeReplyPrioritySection.ts'],
  ['lib/agentTrainingPhaseSubline.ts', 'lib/agentTrainingPhaseSubline.ts'],
  ['lib/trainQueueRateLimitedToast.ts', 'lib/trainQueueRateLimitedToast.ts'],
  ['lib/knowledgeSectionStatusPollGate.ts', 'lib/knowledgeSectionStatusPollGate.ts'],
  ['lib/knowledgeTrainingMutationGate.ts', 'lib/knowledgeTrainingMutationGate.ts'],
  ['lib/knowledgeManualRetry.ts', 'lib/knowledgeManualRetry.ts'],
  ['lib/customerResourceUnavailable.ts', 'lib/adminResourceUnavailable.ts'],
];

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn('skip missing', src);
    return;
  }
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      if (name.includes('.test.')) continue;
      copyRecursive(path.join(src, name), path.join(dest, name));
    }
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

for (const [relSrc, relDest] of copies) {
  copyRecursive(path.join(customerRoot, relSrc), path.join(root, 'src', relDest));
}

const replacements = [
  [/from '\.\.\/\.\.\/\.\.\/api\/customerApi'/g, "from '@/api/adminApi'"],
  [/from "\.\.\/\.\.\/\.\.\/api\/customerApi"/g, 'from "@/api/adminApi"'],
  [/from '\.\.\/\.\.\/api\/customerApi'/g, "from '@/api/adminApi'"],
  [/from '\.\.\/api\/customerApi'/g, "from '@/api/adminApi'"],
  [/from '\.\.\/BotWorkspaceContext'/g, "from '@/auth/AdminBotWorkspaceContext'"],
  [/from '\.\.\/\.\.\/BotWorkspaceContext'/g, "from '@/auth/AdminBotWorkspaceContext'"],
  [/useBotWorkspace/g, 'useAdminBotWorkspace'],
  [/BotWorkspaceProvider/g, 'AdminBotWorkspaceProvider'],
  [/getCustomerBotKnowledgeOverview/g, 'getAdminBotKnowledgeOverview'],
  [/getCustomerBotAgentTrainingStatus/g, 'getAdminBotAgentTrainingStatus'],
  [/getCustomerBotKnowledgePendingTrainingItems/g, 'getAdminBotKnowledgePendingTrainingItems'],
  [/postCustomerBotRetrainAgent/g, 'postAdminBotRetrainAgent'],
  [/patchCustomerBotKnowledgeTrainingSettings/g, 'patchAdminBotKnowledgeTrainingSettings'],
  [/patchCustomerBotKnowledgeReplyPriority/g, 'patchAdminBotKnowledgeReplyPriority'],
  [/postCustomerBotKnowledgeItemRetry/g, 'postAdminBotKnowledgeItemRetry'],
  [/postCustomerBotKnowledgeItemsBulkDelete/g, 'postAdminBotKnowledgeItemsBulkDelete'],
  [/deleteCustomerBotKnowledgeItem/g, 'deleteAdminBotKnowledgeItem'],
  [/getCustomerBotKnowledgeStatus/g, 'getAdminBotKnowledgeStatus'],
  [/postCustomerKnowledgeFaq/g, 'postAdminKnowledgeFaq'],
  [/patchCustomerKnowledgeFaq/g, 'patchAdminKnowledgeFaq'],
  [/postCustomerKnowledgeSnippet/g, 'postAdminKnowledgeSnippet'],
  [/patchCustomerKnowledgeSnippet/g, 'patchAdminKnowledgeSnippet'],
  [/postCustomerKnowledgeDatasheet/g, 'postAdminKnowledgeDatasheet'],
  [/patchCustomerKnowledgeDatasheet/g, 'patchAdminKnowledgeDatasheet'],
  [/patchCustomerKnowledgeDescription/g, 'patchAdminKnowledgeDescription'],
  [/patchCustomerKnowledgeItemUseInReplies/g, 'patchAdminKnowledgeItemUseInReplies'],
  [/getCustomerBotDocuments/g, 'getAdminBotDocuments'],
  [/getCustomerBotDocument\b/g, 'getAdminBotDocument'],
  [/getCustomerBotDocumentDownloadUrl/g, 'getAdminBotDocumentDownloadUrl'],
  [/patchCustomerBotDocument/g, 'patchAdminBotDocument'],
  [/deleteCustomerBotDocument/g, 'deleteAdminBotDocument'],
  [/postCustomerBotDocumentsBulkDelete/g, 'postAdminBotDocumentsBulkDelete'],
  [/postCustomerBotDocumentUpload/g, 'postAdminBotDocumentUpload'],
  [/postAdminBotDocumentEmbed/g, 'postAdminBotDocumentEmbed'],
  [/patchCustomerBot\b/g, 'patchAdminBot'],
  [/CustomerKnowledgeStatusItem/g, 'AdminKnowledgeStatusItem'],
  [/CustomerKnowledgeOverviewResponse/g, 'AdminKnowledgeOverviewResponse'],
  [/CustomerAgentTrainingStatusResponse/g, 'AdminAgentTrainingStatusResponse'],
  [/CustomerPendingTrainingItemsResponse/g, 'AdminPendingTrainingItemsResponse'],
  [/CustomerKnowledgeStatusResponse/g, 'AdminKnowledgeStatusResponse'],
  [/CustomerWorkspaceDocument/g, 'AdminWorkspaceDocument'],
  [/CustomerDocumentsResponse/g, 'AdminDocumentsResponse'],
  [/CustomerDocumentUploadResponse/g, 'AdminDocumentUploadResponse'],
  [/CustomerDocumentDownloadUrlResponse/g, 'AdminDocumentDownloadUrlResponse'],
  [/CustomerKnowledgeItemManualRetryResponse/g, 'AdminKnowledgeItemManualRetryResponse'],
  [/CustomerAgentTrainingDataSourceRow/g, 'AdminAgentTrainingDataSourceRow'],
  [/CustomerBotDetail/g, 'AdminBotWorkspaceBot'],
  [/CustomerKnowledgeFaq/g, 'AdminKnowledgeFaq'],
  [/CustomerKnowledgeSnippet/g, 'AdminKnowledgeSnippet'],
  [/CustomerKnowledgeUsage/g, 'AdminKnowledgeUsage'],
  [/redirectCustomerWorkspacePollGone/g, 'redirectAdminWorkspacePollGone'],
  [/customerKnowledgeItemDelete/g, 'adminKnowledgeItemDelete'],
  [/customerResourceUnavailable/g, 'adminResourceUnavailable'],
  [/useNotifyKbItemDeletedOnce/g, 'useNotifyAdminKbItemDeletedOnce'],
  [/\/bots\/\$\{botId\}\/playground\/knowledgebase/g, '/bots/${botId}/knowledge'],
  [/\/bots\/\$\{id\}\/playground\/knowledgebase/g, '/bots/${id}/knowledge'],
  [/playground\/knowledgebase/g, 'knowledge'],
  [/from '\.\/knowledgePollDisplayHelpers'/g, "from './knowledgePollDisplayHelpers'"],
];

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) {
      walk(p);
      continue;
    }
    if (!/\.(tsx?|css)$/.test(name)) continue;
    let text = fs.readFileSync(p, 'utf8');
    let changed = false;
    for (const [from, to] of replacements) {
      const next = text.replace(from, to);
      if (next !== text) {
        text = next;
        changed = true;
      }
    }
    if (changed) fs.writeFileSync(p, text);
  }
}

walk(path.join(root, 'src', 'pages', 'bot-workspace', 'knowledge'));
walk(path.join(root, 'src', 'pages', 'bot-workspace', 'components'));
if (fs.existsSync(path.join(root, 'src', 'pages', 'bot-workspace', 'KnowledgeSection.tsx'))) {
  let t = fs.readFileSync(path.join(root, 'src', 'pages', 'bot-workspace', 'KnowledgeSection.tsx'), 'utf8');
  for (const [from, to] of replacements) {
    t = t.replace(from, to);
  }
  fs.writeFileSync(path.join(root, 'src', 'pages', 'bot-workspace', 'KnowledgeSection.tsx'), t);
}
walk(path.join(root, 'src', 'context'));
walk(path.join(root, 'src', 'components', 'knowledge'));
walk(path.join(root, 'src', 'lib'));

console.log('port-knowledge-phase6 done');
