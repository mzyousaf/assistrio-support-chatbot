import { redirect } from "next/navigation";

/** @deprecated Use `/trial/dashboard/setup/describe-your-agent`. */
export default function TrialSetupBehaviorRedirectPage() {
  redirect("/trial/dashboard/setup/describe-your-agent");
}
