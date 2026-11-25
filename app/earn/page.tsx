import { redirect } from "next/navigation";

/** Earn is the same screen as Lend & Stake, so there is one address for it. */
export default function EarnPage() {
  redirect("/lend");
}
