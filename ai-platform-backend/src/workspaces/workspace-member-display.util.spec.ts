import {
  resolveWorkspaceMemberAvatarUrl,
  resolveWorkspaceMemberDisplayName,
} from './workspace-member-display.util';

describe('workspace-member-display.util', () => {
  it('prefers displayNameOverride over first/last name', () => {
    expect(
      resolveWorkspaceMemberDisplayName({
        email: 'user@example.com',
        firstName: 'Old',
        lastName: 'Name',
        displayNameOverride: 'Updated Name',
      }),
    ).toBe('Updated Name');
  });

  it('falls back to email when no name fields exist', () => {
    expect(
      resolveWorkspaceMemberDisplayName({
        email: 'user@example.com',
        firstName: null,
        lastName: null,
        displayNameOverride: null,
      }),
    ).toBe('user@example.com');
  });

  it('prefers pictureOverride over Google picture', () => {
    expect(
      resolveWorkspaceMemberAvatarUrl({
        picture: 'https://google.example/photo.jpg',
        pictureOverride: 'https://cdn.example/avatar.png',
      }),
    ).toBe('https://cdn.example/avatar.png');
  });

  it('restores Google picture when override is explicitly null', () => {
    expect(
      resolveWorkspaceMemberAvatarUrl({
        picture: 'https://google.example/photo.jpg',
        pictureOverride: null,
      }),
    ).toBe('https://google.example/photo.jpg');
  });
});
