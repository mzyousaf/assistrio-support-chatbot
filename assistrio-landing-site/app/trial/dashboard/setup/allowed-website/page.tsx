import { redirect } from "next/navigation";

/** @deprecated Use `/trial/dashboard/setup/go-live`. */
export default function TrialSetupAllowedWebsiteRedirectPage() {
  redirect("/trial/dashboard/setup/go-live");
}
