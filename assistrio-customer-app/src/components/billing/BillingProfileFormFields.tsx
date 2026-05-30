import type { WorkspaceBillingProfileInput } from '@/api/types';
import {
  BILLING_INVOICE_COUNTRIES,
  BILLING_INVOICE_US_STATES,
} from '@/lib/billingInvoiceCountries';

export const EMPTY_BILLING_PROFILE_FORM: WorkspaceBillingProfileInput = {
  name: '',
  address: '',
  city: '',
  state: '',
  zipCode: '',
  country: '',
  email: '',
  taxId: '',
  notes: '',
};

type Props = {
  form: WorkspaceBillingProfileInput;
  onChange: (next: WorkspaceBillingProfileInput) => void;
  idPrefix?: string;
  showEmail?: boolean;
  showTaxId?: boolean;
  showNotes?: boolean;
};

export function BillingProfileFormFields({
  form,
  onChange,
  idPrefix = 'billing-profile',
  showEmail = true,
  showTaxId = true,
  showNotes = true,
}: Props) {
  const country = form.country.trim().toUpperCase();
  const requiresState = country === 'US' || country === 'CA';
  const useUsStateDropdown = country === 'US';

  return (
    <>
      <label className="grid gap-1 text-sm text-slate-700" htmlFor={`${idPrefix}-name`}>
        <span className="font-medium">Company / Name</span>
        <input
          id={`${idPrefix}-name`}
          className="rounded-lg border border-slate-200 px-3 py-2"
          value={form.name}
          onChange={(event) => onChange({ ...form, name: event.target.value })}
          required
        />
      </label>
      {showEmail ? (
        <label className="grid gap-1 text-sm text-slate-700" htmlFor={`${idPrefix}-email`}>
          <span className="font-medium">Billing email</span>
          <input
            id={`${idPrefix}-email`}
            type="email"
            className="rounded-lg border border-slate-200 px-3 py-2"
            value={form.email ?? ''}
            onChange={(event) => onChange({ ...form, email: event.target.value })}
          />
        </label>
      ) : null}
      <label className="grid gap-1 text-sm text-slate-700" htmlFor={`${idPrefix}-address`}>
        <span className="font-medium">Address</span>
        <input
          id={`${idPrefix}-address`}
          className="rounded-lg border border-slate-200 px-3 py-2"
          value={form.address}
          onChange={(event) => onChange({ ...form, address: event.target.value })}
          required
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm text-slate-700" htmlFor={`${idPrefix}-city`}>
          <span className="font-medium">City</span>
          <input
            id={`${idPrefix}-city`}
            className="rounded-lg border border-slate-200 px-3 py-2"
            value={form.city}
            onChange={(event) => onChange({ ...form, city: event.target.value })}
            required
          />
        </label>
        <label className="grid gap-1 text-sm text-slate-700" htmlFor={`${idPrefix}-state`}>
          <span className="font-medium">
            State / Province{requiresState ? '' : ' (optional)'}
          </span>
          {useUsStateDropdown ? (
            <select
              id={`${idPrefix}-state`}
              className="rounded-lg border border-slate-200 px-3 py-2"
              value={form.state ?? ''}
              onChange={(event) => onChange({ ...form, state: event.target.value })}
              required
            >
              <option value="">Select state</option>
              {BILLING_INVOICE_US_STATES.map((state) => (
                <option key={state.code} value={state.code}>
                  {state.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              id={`${idPrefix}-state`}
              className="rounded-lg border border-slate-200 px-3 py-2"
              value={form.state ?? ''}
              onChange={(event) => onChange({ ...form, state: event.target.value })}
              required={requiresState}
            />
          )}
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm text-slate-700" htmlFor={`${idPrefix}-zip`}>
          <span className="font-medium">ZIP / Postal code</span>
          <input
            id={`${idPrefix}-zip`}
            className="rounded-lg border border-slate-200 px-3 py-2"
            value={form.zipCode}
            onChange={(event) => onChange({ ...form, zipCode: event.target.value })}
            required
          />
        </label>
        <label className="grid gap-1 text-sm text-slate-700" htmlFor={`${idPrefix}-country`}>
          <span className="font-medium">Country</span>
          <select
            id={`${idPrefix}-country`}
            className="rounded-lg border border-slate-200 px-3 py-2"
            value={form.country}
            onChange={(event) =>
              onChange({
                ...form,
                country: event.target.value,
                state: event.target.value === form.country ? form.state : '',
              })
            }
            required
          >
            <option value="">Select country</option>
            {BILLING_INVOICE_COUNTRIES.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {showTaxId ? (
        <label className="grid gap-1 text-sm text-slate-700" htmlFor={`${idPrefix}-tax-id`}>
          <span className="font-medium">Tax ID</span>
          <input
            id={`${idPrefix}-tax-id`}
            className="rounded-lg border border-slate-200 px-3 py-2"
            value={form.taxId ?? ''}
            onChange={(event) => onChange({ ...form, taxId: event.target.value })}
          />
        </label>
      ) : null}
      {showNotes ? (
        <label className="grid gap-1 text-sm text-slate-700" htmlFor={`${idPrefix}-notes`}>
          <span className="font-medium">Notes</span>
          <textarea
            id={`${idPrefix}-notes`}
            className="min-h-[72px] rounded-lg border border-slate-200 px-3 py-2"
            value={form.notes ?? ''}
            onChange={(event) => onChange({ ...form, notes: event.target.value })}
          />
        </label>
      ) : null}
    </>
  );
}
