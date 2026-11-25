# Make it simpler: audit and plan

Written 2026-11-25. Goal: no new features. Make the existing ones simple and quick to reach.

## What I looked at

The live site (baseanalytics.app) on a computer-sized and a phone-sized screen, **signed out**: Home,
Explore, Trade, Swap, Lend & Stake, Earn, Redeem, Drops, Launch, Profile, Help and Docs, plus the
navigation code. I did **not** see any screen that needs a connected wallet (My Stocks with holdings,
your plans, positions), and I only glanced at Drops, Vouchers and Launch. I have no usage numbers, so
check which pages people actually use before anything is removed.

## The short version

The app does a lot, but the same job often lives in two places, and the most useful things are the
hardest to find. For example, "invest automatically" is a tab inside Swap, with a second, different
version inside Trade, and nothing else in the app links to it.

## Step 1: fix what confuses people today (small changes)

| # | Problem seen | Change |
| --- | --- | --- |
| 1 | Lend & Stake's headline says **"Top supply APY 1251.86%"**. It is the highest rate of any listed market, whatever its size. A number like that looks like a scam. | Only count markets with real money in them, or drop this headline figure. |
| 2 | The recurring form shows the price as **$152.03644218**. | Show $152.04. |
| 3 | Jargon: "DCA AUTOMATION", "Accumulate stock", "Recurring accumulation", "Price ceiling". | "Auto-invest", "Stock", "Buy on a schedule", "Don't buy above". |
| 4 | On a phone, **Lend & Stake is not in the bottom bar**; Drops is. | Put Lend & Stake (or My Stocks) in the bar and move Drops into "More". |
| 5 | On a phone there are two searches (icon and bar) and two menus (top and "More"). The brand reads just "Base". | One search, one menu, full name. |

## Step 2: one place for each job

| Job | Today | Proposed |
| --- | --- | --- |
| Invest automatically | Swap → Recurring (one stock or basket) **and** Trade → Recurring (a different form, no basket) | One **Invest** screen with the basket plan, your plans and the dashboard. Both old places lead to it. |
| Limit and stop orders | Swap → Orders **and** Trade → Limit/Stop | Trade only. Swap just swaps. |
| My money | My Stocks is the 3rd of 6 tabs in Lend, about 1.5 phone screens down, with no link from elsewhere. Profile is only about tokens you launched. | **My Stocks** in the main menu: holdings, target mix, plans and loan health together. |
| Start page | Home and Explore are the same page | Home with three clear buttons: **Buy a stock**, **Invest automatically**, **Earn on your stocks**. |
| Earn | `/earn` and `/lend` show the same screen | `/earn` goes to `/lend`. |
| Help | "Help" opens developer documents (about 8 screens, including API tools) | A short plain help page: how to buy, invest, earn, and what the risks are. Developer docs stay at `/docs`. |

## Step 3: shorter screens

- **Explore** is about **32 phone screens** long with **508 buttons**, 445 of them smaller than a
  comfortable tap. Show one list, 20 rows at a time, with filters. Remove the repeated sections.
- **Lend & Stake**: a large banner, a positions box and a spotlight sit above six tabs. Put the tabs
  first, shrink the banner, and reduce six tabs to three: **Earn**, **Borrow**, **My positions**.
  Scanner and compare become filters inside Earn.
- **Top menu**: eight items. Keep **Invest, Trade, Earn, My Stocks**; move Vouchers, Drops, Launch and
  Profile under **More**.

## Step 4: tidy up behind the scenes

Some screens are no longer shown anywhere (`StocksLendingHub`, `StocksExploreSection` and its tracker,
`StockPortfolioBreakdownCard`). Removing them changes nothing users see and makes later work safer.

## How I would do it

One small pull request per step, each checked on a phone and a computer, with before and after pictures,
and you approve each merge. Old links keep working (they redirect). No contract or money code changes.

## Decisions for you

1. May Drops leave the phone's bottom bar to make room for Lend & Stake or My Stocks?
2. Should auto-invest and orders move out of Swap, as in Step 2?
3. Start with Step 1? (Recommended: it fixes the trust problem in row 1 first.)
