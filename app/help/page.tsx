import { redirect } from "next/navigation";

/** Legacy route — Documents lives at /docs */
export default function HelpPage() {
  redirect("/docs");
}
