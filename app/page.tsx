import HomeApp from "@/components/home/HomeApp";

export default function Page() {
  return (
    <>
      {/* The visible heading on this page is an h2, so the homepage gets its page heading here
          for search engines and screen readers. */}
      <h1 className="sr-only">Base Analytics: buy tokenized stocks on Base, invest on a schedule, earn or borrow</h1>
      <HomeApp />
    </>
  );
}
