import { redirect } from "next/navigation";

export default async function WalletProfilePage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  redirect(`/creator/${address}`);
}
