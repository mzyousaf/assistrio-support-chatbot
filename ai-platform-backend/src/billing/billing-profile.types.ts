export type WorkspaceBillingProfileInput = {
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  taxId?: string;
  email?: string;
  notes?: string;
};

export type WorkspaceBillingProfileRecord = {
  workspaceId: string;
  name: string;
  address: string;
  city: string;
  state?: string;
  zipCode: string;
  country: string;
  taxId?: string;
  email?: string;
  notes?: string;
  updatedAt: string;
  updatedBy: string;
};
