import HomeApp from "@/components/home/HomeApp";

export default function Page() {
  return (
    <>
      {/* The visible hero is an h2 (it's shared with /explore, which has its own h1), so the
          homepage gets its page heading here for search engines and screen readers. */}
      <h1 className="sr-only">Base Analytics: find tokens and tokenized stocks on Base, swap in seconds</h1>
      <HomeApp />
    </>
  );
}
