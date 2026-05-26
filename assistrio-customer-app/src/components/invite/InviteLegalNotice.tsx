import { getPrivacyPolicyUrl, getTermsOfServiceUrl } from '@/lib/legalUrls';
import { cn } from '@/lib/utils';

const linkClassName =
  'font-medium text-teal-700 no-underline hover:underline';

type Props = {
  className?: string;
};

export function InviteLegalNotice({ className }: Props) {
  const termsUrl = getTermsOfServiceUrl();
  const privacyUrl = getPrivacyPolicyUrl();

  return (
    <p className={cn('mb-0 mt-3 text-center text-[0.6875rem] leading-relaxed text-slate-400', className)}>
      By continuing, you agree to our{' '}
      {termsUrl ? (
        <a href={termsUrl} className={linkClassName} target="_blank" rel="noopener noreferrer">
          Terms of Service
        </a>
      ) : (
        'Terms of Service'
      )}{' '}
      and{' '}
      {privacyUrl ? (
        <a href={privacyUrl} className={linkClassName} target="_blank" rel="noopener noreferrer">
          Privacy Policy
        </a>
      ) : (
        'Privacy Policy'
      )}
      .
    </p>
  );
}
