/**
 * Unit tests for lead capture helpers: extraction, decline detection, merge overwrite.
 */

import {
  buildLeadCaptureContext,
  classifyLeadIntent,
  detectDecline,
  detectDeclineResult,
  extractLeadFieldsFromMessage,
  getFieldOverwritePolicy,
  getLeadStateFromConversation,
  mergeExtractedLeadData,
  mergeExtractedLeadDataWithDebug,
} from './lead-capture.helper';

describe('getLeadStateFromConversation', () => {
  it('returns empty state when config disabled or no fields', () => {
    expect(getLeadStateFromConversation(undefined, undefined).requiredFields).toEqual([]);
    expect(getLeadStateFromConversation({}, { enabled: false, fields: [] }).fieldLabels).toEqual({});
  });

  it('derives required/optional and fieldLabels from config', () => {
    const config = {
      enabled: true,
      fields: [
        { key: 'email', label: 'Email', required: true },
        { key: 'company', label: 'Company', required: false },
      ],
    };
    const state = getLeadStateFromConversation({}, config);
    expect(state.requiredFields).toEqual(['email']);
    expect(state.optionalFields).toEqual(['company']);
    expect(state.fieldLabels.email).toBe('Email');
    expect(state.fieldAliases).toEqual({});
  });

  it('includes fieldAliases when fields have aliases', () => {
    const config = {
      enabled: true,
      fields: [{ key: 'team_size', label: 'Team Size', required: true, aliases: ['employees', 'staff'] }],
    };
    const state = getLeadStateFromConversation({}, config);
    expect(state.fieldAliases.team_size).toEqual(['employees', 'staff']);
  });
});

describe('extractLeadFieldsFromMessage', () => {
  const fieldLabels: Record<string, string> = { email: 'Email', name: 'Name', phone: 'Phone', company: 'Company' };

  it('extracts email with regex', () => {
    const r = extractLeadFieldsFromMessage('Contact me at john@example.com please', ['email'], fieldLabels);
    expect(r.extracted.email).toBe('john@example.com');
    expect(r.matchedByField.email).toBe('regex');
    expect(r.confidenceByField.email).toBe(1);
  });

  it('extracts phone with regex', () => {
    const r = extractLeadFieldsFromMessage('My number is 555-123-4567', ['phone'], fieldLabels);
    expect(r.extracted.phone).toBeTruthy();
    expect(r.matchedByField.phone).toBe('regex');
  });

  it('extracts name from "my name is X"', () => {
    const r = extractLeadFieldsFromMessage("My name is Alice", ['name'], fieldLabels);
    expect(r.extracted.name?.toLowerCase()).toBe('alice');
    expect(r.matchedByField.name).toBe('heuristic');
  });

  it('extracts company from "work at X"', () => {
    const r = extractLeadFieldsFromMessage('I work at Acme Corp', ['company'], fieldLabels);
    expect(r.extracted.company?.toLowerCase()).toBe('acme corp');
  });

  it('extracts last-asked custom field as direct answer', () => {
    const r = extractLeadFieldsFromMessage('We use Salesforce', ['crm'], { crm: 'CRM' }, {
      lastAskedField: 'crm',
    });
    expect(r.extracted.crm).toBe('We use Salesforce');
    expect(r.matchedByField.crm).toBe('generic_custom');
  });

  it('uses bot aliases for spontaneous extraction', () => {
    const r = extractLeadFieldsFromMessage(
      'We have 30 employees',
      ['team_size'],
      { team_size: 'Team Size' },
      { fieldAliases: { team_size: ['employees', 'staff'] } },
    );
    expect(r.extracted.team_size).toBeTruthy();
    expect(r.matchedByField.team_size).toBe('contextual');
  });
});

describe('detectDeclineResult / detectDecline', () => {
  it('returns declined for clear refusal', () => {
    expect(detectDeclineResult("I don't want to share that")).toBe('declined');
    expect(detectDeclineResult('Skip that')).toBe('declined');
    expect(detectDecline('Prefer not to say')).toBe(true);
  });

  it('returns postponed for "later" style', () => {
    expect(detectDeclineResult('Maybe later')).toBe('postponed');
    expect(detectDeclineResult('Not now')).toBe('postponed');
    expect(detectDeclineResult("Let's discuss later")).toBe('postponed');
  });

  it('returns partial for uncertain short answers', () => {
    expect(detectDeclineResult('Kind of')).toBe('partial');
    expect(detectDeclineResult('It depends')).toBe('partial');
  });

  it('returns null for long or neutral messages', () => {
    expect(detectDeclineResult('')).toBeNull();
    expect(detectDeclineResult('a'.repeat(201))).toBeNull();
  });
});

describe('classifyLeadIntent', () => {
  it('classifies urgent/support/pricing/buying/browsing', () => {
    expect(classifyLeadIntent('This is urgent!')).toBe('urgent');
    expect(classifyLeadIntent('I need help with an error')).toBe('support');
    expect(classifyLeadIntent('What is the pricing?')).toBe('pricing_contact');
    expect(classifyLeadIntent('I want to buy the plan')).toBe('buying');
    expect(classifyLeadIntent('Just looking')).toBe('browsing');
    expect(classifyLeadIntent('I would like to know more about your product and features')).toBe('unknown');
  });
});

describe('getFieldOverwritePolicy', () => {
  it('returns high threshold for email/phone', () => {
    expect(getFieldOverwritePolicy('email')).toBeGreaterThanOrEqual(0.95);
    expect(getFieldOverwritePolicy('phone')).toBeGreaterThanOrEqual(0.95);
  });

  it('returns lower threshold for budget/timeline', () => {
    expect(getFieldOverwritePolicy('budget')).toBeLessThan(0.9);
    expect(getFieldOverwritePolicy('timeline')).toBeLessThan(0.9);
  });

  it('returns default for unknown field', () => {
    expect(getFieldOverwritePolicy('custom_field')).toBe(0.8);
  });
});

describe('mergeExtractedLeadData / mergeExtractedLeadDataWithDebug', () => {
  it('merges when no existing value', () => {
    const out = mergeExtractedLeadData({}, { email: 'a@b.com' });
    expect(out.email).toBe('a@b.com');
  });

  it('does not overwrite when confidence below threshold', () => {
    const out = mergeExtractedLeadData(
      { email: 'old@x.com' },
      { email: 'new@y.com' },
      { email: 0.5 },
      0.9,
    );
    expect(out.email).toBe('old@x.com');
  });

  it('overwrites when confidence meets threshold', () => {
    const out = mergeExtractedLeadData(
      { email: 'old@x.com' },
      { email: 'new@y.com' },
      { email: 0.95 },
      0.9,
    );
    expect(out.email).toBe('new@y.com');
  });

  it('mergeExtractedLeadDataWithDebug returns overwritten and skipped', () => {
    const result = mergeExtractedLeadDataWithDebug(
      { email: 'keep@x.com', name: 'Old' },
      { email: 'drop@y.com', name: 'New' },
      { email: 0.5, name: 0.95 },
      undefined,
      { email: 'email', name: 'text' },
    );
    expect(result.collected.email).toBe('keep@x.com');
    expect(result.collected.name).toBe('New');
    expect(result.skipped).toContain('email');
    expect(result.overwritten).toContain('name');
  });
});

describe('buildLeadCaptureContext', () => {
  it('shouldAskNow false when next field is in declinedFields', () => {
    const ctx = buildLeadCaptureContext(
      {},
      ['email'],
      [],
      { email: 'Email' },
      {
        meta: { declinedFields: ['email'], lastAskedField: 'email', lastAskedMessageCount: 1 },
        messageCountInConversation: 2,
        shouldAskThisTurn: true,
      },
    );
    expect(ctx.shouldAskNow).toBe(false);
  });
});
