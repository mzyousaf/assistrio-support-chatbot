import { redirect } from "next/navigation";

export default function UserSettingsIndexPage() {
  redirect("/user/settings/general");
}
