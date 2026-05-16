import type { CustomerLeadDetail } from '@/api/types';
import {
  dashUnlessText,
  deviceTypeCustomerLabel,
  formatBrowserOsLine,
  INSIGHT_EM_DASH,
  screenSizeDisplay,
} from '../conversations/conversationInsightsFormatting';
import {
  ConversationInsightsSheetSection,
  ConversationInsightsSheetRow,
} from '../conversations/ConversationInsightsSheet';
import { leadDetailSheetSectionClassName } from './leadsUiHelpers';

function formatLocationSource(raw: string | undefined): string {
  const s = raw?.trim().toLowerCase();
  if (!s) return '';
  if (s === 'ip_lookup') return 'IP-based estimate';
  if (s === 'browser_timezone') return 'Browser / timezone';
  return raw!.trim().replace(/_/g, ' ');
}

type Props = {
  detail: CustomerLeadDetail;
};

export function LeadLocationDeviceSection({ detail }: Props) {
  const loc = detail.location;
  const dev = detail.deviceInfo;
  const { browserLine, osLine } = formatBrowserOsLine(dev?.browser, dev?.browserVersion, dev?.os, dev?.osVersion);

  const countryCombined = [loc?.country?.trim(), loc?.countryCode?.trim() ? `(${loc.countryCode.trim()})` : '']
    .filter(Boolean)
    .join(' ')
    .trim();
  const locSource = formatLocationSource(loc?.source);

  return (
    <>
      <ConversationInsightsSheetSection title="Location" className={leadDetailSheetSectionClassName}>
        <ConversationInsightsSheetRow label="Country" value={countryCombined ? countryCombined : INSIGHT_EM_DASH} />
        <ConversationInsightsSheetRow label="Region" value={dashUnlessText(loc?.region)} />
        <ConversationInsightsSheetRow label="City" value={dashUnlessText(loc?.city)} />
        <ConversationInsightsSheetRow label="Timezone" value={dashUnlessText(loc?.timezone)} />
        <ConversationInsightsSheetRow label="Location estimate" value={locSource ? locSource : INSIGHT_EM_DASH} />
      </ConversationInsightsSheetSection>

      <ConversationInsightsSheetSection title="Device" className={leadDetailSheetSectionClassName}>
        <ConversationInsightsSheetRow label="Device type" value={deviceTypeCustomerLabel(dev?.deviceType)} />
        <ConversationInsightsSheetRow label="Browser" value={browserLine} />
        <ConversationInsightsSheetRow label="OS" value={osLine} />
        <ConversationInsightsSheetRow
          label="Screen"
          value={screenSizeDisplay(dev?.screenWidth, dev?.screenHeight)}
        />
        <ConversationInsightsSheetRow label="Language" value={dashUnlessText(dev?.language)} />
      </ConversationInsightsSheetSection>
    </>
  );
}
