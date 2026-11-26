/** One fixed sharing image per section: a headline and a line, no live numbers. */
export const OG_SECTIONS = {
  home: ["Tokenized stocks on Base", "Explore, trade, borrow and send gifts."],
  markets: ["Stocks and tokens", "Live markets on Base, with a watchlist."],
  trade: ["Charts and orders", "Coins and tokenized stocks on Base."],
  swap: ["Swap on Base", "Exchange tokens and tokenized stocks."],
  earn: ["Lend, borrow and earn", "Borrow cash against your stocks."],
  launch: ["Launch a token", "Create one on Base and earn on trades."],
  drops: ["Drops", "Gifts with rules and tasks on Base."],
  docs: ["Documents and API", "Guides, contracts and developer tools."],
  help: ["Help", "How to buy, invest and earn, and the risks."],
  creator: ["Creator profile", "Token launches and earnings on Base."],
  pay: ["Pay or tip on Base", "Always check who you are paying."],
} as const;

export type OgSection = keyof typeof OG_SECTIONS;

export const isOgSection = (value: string | null): value is OgSection =>
  value !== null && Object.prototype.hasOwnProperty.call(OG_SECTIONS, value);
