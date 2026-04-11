import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Playground",
};

export default function TrialPlaygroundLayout({ children }: { children: React.ReactNode }) {
  return children;
}
