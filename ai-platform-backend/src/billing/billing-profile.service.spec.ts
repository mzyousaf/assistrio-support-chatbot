import { BadRequestException } from '@nestjs/common';
import { BillingProfileService } from './billing-profile.service';

describe('BillingProfileService', () => {
  const workspaceId = '507f1f77bcf86cd799439011';
  const userId = '507f1f77bcf86cd799439012';

  function createService(profileDoc: unknown = null) {
    const profileModel = {
      findOne: jest.fn().mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(profileDoc),
        }),
      }),
      findOneAndUpdate: jest.fn().mockReturnValue({
        exec: jest.fn().mockImplementation(async () => ({
          name: 'Jane Doe',
          address: '123 Mall Road',
          city: 'Lahore',
          state: null,
          zipCode: '54000',
          country: 'PK',
          taxId: null,
          email: null,
          notes: null,
          updatedAt: new Date('2026-05-01T00:00:00.000Z'),
          updatedBy: userId,
        })),
      }),
    };

    return {
      service: new BillingProfileService(profileModel as never),
      profileModel,
    };
  }

  it('returns null when no profile exists', async () => {
    const { service } = createService(null);
    await expect(service.getProfile(workspaceId)).resolves.toBeNull();
    await expect(service.hasCompleteProfile(workspaceId)).resolves.toBe(false);
  });

  it('saves billing profile with uppercase country', async () => {
    const { service, profileModel } = createService();
    const profile = await service.upsertProfile(workspaceId, userId, {
      name: 'Jane Doe',
      address: '123 Mall Road',
      city: 'Lahore',
      zipCode: '54000',
      country: 'pk',
    });

    expect(profileModel.findOneAndUpdate).toHaveBeenCalled();
    expect(profile.country).toBe('PK');
  });

  it('rejects invalid US state on save', async () => {
    const { service } = createService();
    await expect(
      service.upsertProfile(workspaceId, userId, {
        name: 'Jane Doe',
        address: '123 Mall Road',
        city: 'Lahore',
        state: 'Punjab',
        zipCode: '54000',
        country: 'US',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns invoice details from saved profile', async () => {
    const { service } = createService({
      name: 'Jane Doe',
      address: '123 Mall Road',
      city: 'Lahore',
      state: null,
      zipCode: '54000',
      country: 'PK',
      taxId: null,
      email: null,
      notes: null,
      updatedAt: new Date('2026-05-01T00:00:00.000Z'),
      updatedBy: userId,
    });

    await expect(service.getInvoiceDetailsForOrder(workspaceId)).resolves.toMatchObject({
      name: 'Jane Doe',
      country: 'PK',
    });
  });
});
