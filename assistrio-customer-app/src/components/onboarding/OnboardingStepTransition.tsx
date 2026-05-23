import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ONBOARDING_STEPS, stepIndex } from '@/onboarding/onboardingState';

function currentStepFromPathname(pathname: string): string {
  const seg = pathname.replace(/.*\/onboarding\/?/, '').split('/').filter(Boolean)[0] ?? '';
  return seg && ONBOARDING_STEPS.some((s) => s.path === seg) ? seg : ONBOARDING_STEPS[0].path;
}

type StepPaneProps = {
  direction: 'forward' | 'back';
};

/** Keyed per route so each step mounts with visible=false and can animate in. */
function OnboardingStepTransitionPane({ direction }: StepPaneProps) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useLayoutEffect(() => {
    setVisible(false);
    const el = innerRef.current;
    if (!el) return;

    // Force the browser to commit the "from" styles before transitioning to visible.
    void el.getBoundingClientRect();

    const frame = requestAnimationFrame(() => {
      void el.getBoundingClientRect();
      setVisible(true);
    });

    return () => cancelAnimationFrame(frame);
  }, [direction]);

  return (
    <div
      ref={innerRef}
      className={cn(
        'onboarding-step-transition-inner',
        direction === 'forward'
          ? 'onboarding-step-transition--forward'
          : 'onboarding-step-transition--back',
        visible && 'is-visible',
      )}
    >
      <Outlet />
    </div>
  );
}

/** Animated wrapper for onboarding step routes — per-step enter animation on step change. */
export function OnboardingStepTransition() {
  const { pathname } = useLocation();
  const stepPath = currentStepFromPathname(pathname);
  const stepIdx = stepIndex(stepPath);
  const prevStepIdxRef = useRef(stepIdx);
  const direction = stepIdx >= prevStepIdxRef.current ? 'forward' : 'back';

  useEffect(() => {
    prevStepIdxRef.current = stepIdx;
  }, [stepIdx]);

  useEffect(() => {
    const main = document.querySelector<HTMLElement>('.onboarding-main-content');
    main?.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="onboarding-step-transition">
      <OnboardingStepTransitionPane key={pathname} direction={direction} />
    </div>
  );
}
