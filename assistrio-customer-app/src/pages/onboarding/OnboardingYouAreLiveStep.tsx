import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useOnboardingFlow } from '../../onboarding/OnboardingFlowContext';

/**
 * Compatibility redirect for the removed "You are live" onboarding step.
 */
export function OnboardingYouAreLiveStep() {
  const { onboarding, finishOnboarding } = useOnboardingFlow();
  const [completeError, setCompleteError] = useState<string | null>(null);
  const completingRef = useRef(false);

  const botId = onboarding?.onboardingCreatedBotId ?? null;
  const status = onboarding?.onboardingStatus;

  useEffect(() => {
    if (status !== 'live_pending_install' || !botId || completingRef.current) return;
    completingRef.current = true;
    setCompleteError(null);
    void finishOnboarding({ liveBotId: botId, showInstall: true }).catch((err) => {
      completingRef.current = false;
      setCompleteError(err instanceof Error ? err.message : 'Could not complete onboarding.');
    });
  }, [botId, finishOnboarding, status]);

  if (status === 'completed') {
    if (botId) {
      return <Navigate to={`/bots?liveBotId=${encodeURIComponent(botId)}&showInstall=1`} replace />;
    }
    return <Navigate to="/bots" replace />;
  }

  if (status === 'live_pending_install' && botId) {
    if (completeError) {
      return <Navigate to="/onboarding/go-live" replace state={{ completeError }} />;
    }
    return null;
  }

  return <Navigate to="/onboarding/go-live" replace />;
}
