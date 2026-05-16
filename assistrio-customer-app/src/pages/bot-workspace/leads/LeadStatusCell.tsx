import type { CustomerLeadFieldDefinition, CustomerLeadListItem } from '@/api/types';
import { leadQualityFromCaptured } from './leadsUiHelpers';
import { LeadQualityBadge } from './LeadQualityBadge';

type Props = {
  lead: CustomerLeadListItem;
  fieldDefinitions: CustomerLeadFieldDefinition[];
};

export function LeadStatusCell({ lead, fieldDefinitions }: Props) {
  const q = leadQualityFromCaptured(lead.capturedLeadData, fieldDefinitions);
  return <LeadQualityBadge kind={q.kind} label={q.label} />;
}
