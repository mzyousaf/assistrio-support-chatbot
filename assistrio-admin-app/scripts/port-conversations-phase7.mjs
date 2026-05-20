/**
 * Copy customer conversation insights UI into admin app.
 * Run: node scripts/port-conversations-phase7.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const customerRoot = path.join(root, '..', 'assistrio-customer-app', 'src');

const copies = [
  ['pages/bot-workspace/conversations', 'pages/bot-workspace/conversations'],
  ['pages/bot-workspace/ConversationsInsightsPage.tsx', 'pages/bot-workspace/AdminConversationsInsightsPage.tsx'],
  ['pages/bot-workspace/analytics/shared', 'pages/bot-workspace/analytics/shared'],
  ['pages/bot-workspace/analytics/sentiment/sentimentChartTheme.ts', 'pages/bot-workspace/analytics/sentiment/sentimentChartTheme.ts'],
  ['pages/bot-workspace/analytics/topics/topicTaxonomy.ts', 'pages/bot-workspace/analytics/topics/topicTaxonomy.ts'],
  ['pages/bot-workspace/leads/leadsFilterCountryOptions.ts', 'pages/bot-workspace/leads/leadsFilterCountryOptions.ts'],
  ['pages/bot-workspace/leads/conversationInsightsDeepLink.ts', 'pages/bot-workspace/leads/conversationInsightsDeepLink.ts'],
  ['lib/conversationDateFormat.ts', 'lib/conversationDateFormat.ts'],
  ['lib/safeClientString.ts', 'lib/safeClientString.ts'],
  ['lib/analyticsFormat.ts', 'lib/analyticsFormat.ts'],
  ['lib/analyticsQueryDates.ts', 'lib/analyticsQueryDates.ts'],
  ['lib/chatsAnalyticsQuery.ts', 'lib/chatsAnalyticsQuery.ts'],
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
  [/from '\.\/BotWorkspaceContext'/g, "from '@/auth/AdminBotWorkspaceContext'"],
  [/from '\.\.\/BotWorkspaceContext'/g, "from '@/auth/AdminBotWorkspaceContext'"],
  [/useBotWorkspace/g, 'useAdminBotWorkspace'],
  [/getCustomerBotConversations/g, 'getAdminBotConversations'],
  [/getCustomerBotConversationDetail/g, 'getAdminBotConversationDetail'],
  [/getCustomerBotConversationMessages/g, 'getAdminBotConversationMessages'],
  [/postCustomerKnowledgeFaq/g, 'postAdminKnowledgeFaq'],
  [/postCustomerKnowledgeSnippet/g, 'postAdminKnowledgeSnippet'],
  [/CustomerBotConversationsListParams/g, 'AdminBotConversationsListParams'],
  [/CustomerConversationDetail/g, 'AdminConversationDetail'],
  [/CustomerConversationListItem/g, 'AdminConversationListItem'],
  [/CustomerConversationMessage/g, 'AdminConversationMessage'],
  [/CustomerConversationMessageFeedback/g, 'AdminConversationMessageFeedback'],
  [/CustomerConversationMessageSource/g, 'AdminConversationMessageSource'],
  [/CustomerConversationMessageAiMeta/g, 'AdminConversationMessageAiMeta'],
  [/CustomerConversationMessageAttachment/g, 'AdminConversationMessageAttachment'],
  [/CustomerConversationMessageSpeechInput/g, 'AdminConversationMessageSpeechInput'],
  [/CustomerConversationVoiceMeta/g, 'AdminConversationVoiceMeta'],
  [/CustomerConversationMessageCreditBreakdownRow/g, 'AdminConversationMessageCreditBreakdownRow'],
  [/CustomerConversationMessageTopics/g, 'AdminConversationMessageTopics'],
  [/CustomerConversationMessageSentiment/g, 'AdminConversationMessageSentiment'],
  [/CustomerConversationOriginSummary/g, 'AdminConversationOriginSummary'],
  [/CustomerConversationLocationSummary/g, 'AdminConversationLocationSummary'],
  [/CustomerConversationDeviceSummary/g, 'AdminConversationDeviceSummary'],
  [/CustomerConversationSentimentSummary/g, 'AdminConversationSentimentSummary'],
  [/CustomerConversationTopicsSummary/g, 'AdminConversationTopicsSummary'],
  [/CustomerConversationOriginDetail/g, 'AdminConversationOriginDetail'],
  [/CustomerConversationLocationDetail/g, 'AdminConversationLocationDetail'],
  [/CustomerConversationDeviceDetail/g, 'AdminConversationDeviceDetail'],
  [/CustomerBotConversationsListResponse/g, 'AdminBotConversationsListResponse'],
  [/customerConversationInsightsPath/g, 'adminConversationInsightsPath'],
  [/ConversationsInsightsPage/g, 'AdminConversationsInsightsPage'],
];

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) {
      walk(p);
      continue;
    }
    if (!/\.(tsx?)$/.test(name)) continue;
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

walk(path.join(root, 'src', 'pages', 'bot-workspace', 'conversations'));
walk(path.join(root, 'src', 'pages', 'bot-workspace', 'analytics'));
walk(path.join(root, 'src', 'pages', 'bot-workspace', 'leads'));
if (fs.existsSync(path.join(root, 'src', 'pages', 'bot-workspace', 'AdminConversationsInsightsPage.tsx'))) {
  let t = fs.readFileSync(path.join(root, 'src', 'pages', 'bot-workspace', 'AdminConversationsInsightsPage.tsx'), 'utf8');
  for (const [from, to] of replacements) t = t.replace(from, to);
  // Admin operators always get Advanced tab; drop customer auth import
  t = t.replace(/import \{ useCustomerAuth \} from '@\/auth\/CustomerAuthContext';\r?\n/, '');
  t = t.replace(
    /const \{ customer \} = useCustomerAuth\(\);\r?\n/,
    '',
  );
  t = t.replace(
    /const insightsAdvancedAllowed = conversationInsightsAdminTabEnabled\(customer\?\.role\);/,
    'const insightsAdvancedAllowed = conversationInsightsAdminTabEnabled("superadmin");',
  );
  fs.writeFileSync(path.join(root, 'src', 'pages', 'bot-workspace', 'AdminConversationsInsightsPage.tsx'), t);
}

console.log('port-conversations-phase7 done');
