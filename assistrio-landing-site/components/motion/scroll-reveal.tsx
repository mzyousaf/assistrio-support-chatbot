"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";

const ease = [0.22, 1, 0.36, 1] as const;

type ScrollRevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  /** Vertical offset in px — slightly subtler for dense sections */
  y?: number;
};

export function ScrollReveal({ children, className = "", delay = 0, y = 28 }: ScrollRevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10% 0px -8% 0px", amount: 0.2 }}
      transition={{ duration: 0.55, ease, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

type MotionDivProps = Omit<HTMLMotionProps<"div">, "children"> & { children: ReactNode };

/** Small utility for hover lift on marketing surfaces */
export function MotionLift({ children, className = "", ...rest }: MotionDivProps) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
