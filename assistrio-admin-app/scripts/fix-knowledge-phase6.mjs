import fs from 'node:fs';
import path from 'node:path';

const root = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..');

const reps = [
  [/bulkDeleteCustomerKnowledgeItems/g, 'bulkDeleteAdminKnowledgeItems'],
  [/reportCustomerKnowledgeItemDeleteRejected/g, 'reportAdminKnowledgeItemDeleteRejected'],
  [/tryHandleCustomerResourceGone/g, 'tryHandleAdminResourceGone'],
  [/isCustomerResourceUnavailable/g, 'isAdminResourceUnavailable'],
  [/useNotifyKbItemDeletedOnce/g, 'useNotifyAdminKbItemDeletedOnce'],
  [/CustomerPendingTrainingItemDisplayStatus/g, 'AdminPendingTrainingItemDisplayStatus'],
  [/CustomerPendingTrainingSectionType/g, 'AdminPendingTrainingSectionType'],
  [/\$\{base\}\/snippets/g, '${base}/notes'],
  [/\/snippets\//g, '/notes/'],
  [/from '@\/lib\/adminKnowledgeItemDelete'/g, "from '@/lib/adminKnowledgeItemDelete'"],
];

function walk(d) {
  if (!fs.existsSync(d)) return;
  for (const n of fs.readdirSync(d)) {
    const p = path.join(d, n);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx?)$/.test(n)) {
      let t = fs.readFileSync(p, 'utf8');
      let changed = false;
      for (const [a, b] of reps) {
        const next = t.replace(a, b);
        if (next !== t) {
          t = next;
          changed = true;
        }
      }
      if (changed) fs.writeFileSync(p, t);
    }
  }
}

walk(path.join(root, 'src', 'pages', 'bot-workspace', 'knowledge'));
walk(path.join(root, 'src', 'pages', 'bot-workspace', 'components'));
for (const f of ['adminKnowledgeItemDelete.ts', 'adminResourceUnavailable.ts']) {
  const p = path.join(root, 'src', 'lib', f);
  if (fs.existsSync(p)) {
    let t = fs.readFileSync(p, 'utf8');
    for (const [a, b] of reps) t = t.replace(a, b);
    fs.writeFileSync(
      p,
      t
        .replace(/bulkDeleteCustomerKnowledgeItems/g, 'bulkDeleteAdminKnowledgeItems')
        .replace(/reportCustomerKnowledgeItemDeleteRejected/g, 'reportAdminKnowledgeItemDeleteRejected')
        .replace(/deleteCustomerKnowledgeItemsSequential/g, 'bulkDeleteAdminKnowledgeItems')
        .replace(/CustomerFailResponse/g, 'AdminFailResponse')
        .replace(/isCustomerResourceUnavailable/g, 'isAdminResourceUnavailable')
        .replace(/tryHandleCustomerResourceGone/g, 'tryHandleAdminResourceGone'),
    );
  }
}

console.log('fix-knowledge-phase6 done');
