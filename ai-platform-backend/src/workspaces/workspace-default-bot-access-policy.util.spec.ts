import {
  DEFAULT_WORKSPACE_DEFAULT_BOT_ACCESS_POLICY,
  normalizeWorkspaceDefaultBotAccessPolicy,
  parseWorkspaceDefaultBotAccessPolicyPatch,
} from './workspace-default-bot-access-policy.util';

describe('normalizeWorkspaceDefaultBotAccessPolicy', () => {
  it('defaults both flags to false', () => {
    expect(normalizeWorkspaceDefaultBotAccessPolicy()).toEqual(DEFAULT_WORKSPACE_DEFAULT_BOT_ACCESS_POLICY);
  });

  it('preview on forces view on', () => {
    expect(
      normalizeWorkspaceDefaultBotAccessPolicy({
        grantViewToWorkspacePeopleOnCreate: false,
        grantPreviewToWorkspacePeopleOnCreate: true,
      }),
    ).toEqual({
      grantViewToWorkspacePeopleOnCreate: true,
      grantPreviewToWorkspacePeopleOnCreate: true,
    });
  });

  it('view off clears preview', () => {
    expect(
      normalizeWorkspaceDefaultBotAccessPolicy({
        grantViewToWorkspacePeopleOnCreate: false,
        grantPreviewToWorkspacePeopleOnCreate: false,
      }),
    ).toEqual({
      grantViewToWorkspacePeopleOnCreate: false,
      grantPreviewToWorkspacePeopleOnCreate: false,
    });
  });
});

describe('parseWorkspaceDefaultBotAccessPolicyPatch', () => {
  it('parses nested policy', () => {
    expect(
      parseWorkspaceDefaultBotAccessPolicyPatch({
        defaultBotAccessPolicy: {
          grantViewToWorkspacePeopleOnCreate: true,
          grantPreviewToWorkspacePeopleOnCreate: false,
        },
      }),
    ).toEqual({
      grantViewToWorkspacePeopleOnCreate: true,
      grantPreviewToWorkspacePeopleOnCreate: false,
    });
  });

  it('returns null for invalid body', () => {
    expect(parseWorkspaceDefaultBotAccessPolicyPatch(null)).toBeNull();
    expect(parseWorkspaceDefaultBotAccessPolicyPatch({})).toBeNull();
  });
});
