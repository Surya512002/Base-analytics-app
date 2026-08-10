import HomeApp from "@/components/home/HomeApp";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SwapPage({ searchParams }: Props) {
  const params = searchParams ? await searchParams : {};
  const raw = params.token;
  const token = (Array.isArray(raw) ? raw[0] : raw)?.trim().toLowerCase() ?? null;
  const valid = token?.startsWith("0x") && token.length === 42 ? token : null;
  return <HomeApp forceTab="swap" initialToken={valid} />;
}
