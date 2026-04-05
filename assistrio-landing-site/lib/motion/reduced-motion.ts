import type { Transition } from "framer-motion";

/** Short, calm transitions when the user prefers reduced motion. */
export const reducedEaseTransition: Transition = {
  duration: 0.22,
  ease: [0.22, 1, 0.36, 1],
};

export function panelTransition(reduceMotion: boolean | null, spring: Transition): Transition {
  if (reduceMotion) return reducedEaseTransition;
  return spring;
}

export function stepContentTransition(
  reduceMotion: boolean | null,
  spring: Transition,
): Transition {
  if (reduceMotion) return reducedEaseTransition;
  return spring;
}

export function stepMotionVariants(reduceMotion: boolean | null, dir: 1 | -1) {
  if (reduceMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    };
  }
  return {
    initial: { opacity: 0, x: dir * 22 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: dir * -18 },
  };
}

export function showcaseStepMotionVariants(reduceMotion: boolean | null, dir: 1 | -1) {
  if (reduceMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    };
  }
  return {
    initial: { opacity: 0, x: dir * 18 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: dir * -14 },
  };
}
