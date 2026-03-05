import { NextResponse } from 'next/server';
import { TwitterApi } from 'twitter-api-v2';
import OpenAI from 'openai';

// 1. Initialize the brains (Routing through Gemini!)
const openai = new OpenAI({ 
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/" 
});

// Initialize the voice (X / Twitter)
const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY!,
  appSecret: process.env.TWITTER_API_SECRET!,
  accessToken: process.env.TWITTER_ACCESS_TOKEN!,
  accessSecret: process.env.TWITTER_ACCESS_SECRET!,
});

// Define the exact shape of the CoinGecko data so TypeScript is happy
interface CoinMarketData {
  symbol: string;
  current_price: number;
  price_change_percentage_24h: number;
}

export async function GET(request: Request) {
  // 2. SECURITY CHECK: Make sure only Vercel Cron (or you) can trigger this
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized - Nice try, hacker!', { status: 401 });
  }

  try {
    // 3. FETCH THE DATA (Live Base network token data)
    const BASE_NATIVE_IDS = 'degen-base,aerodrome-finance,based-brett,higher';
    const response = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${BASE_NATIVE_IDS}&order=volume_desc&price_change_percentage=24h`);
    
    // Explicitly tell TypeScript this data is an array of CoinMarketData
    const marketData: CoinMarketData[] = await response.json();

    // Format the data so the AI can understand it easily
    const marketSummary = marketData.map((coin) => 
      `${coin.symbol.toUpperCase()}: $${coin.current_price} (${coin.price_change_percentage_24h?.toFixed(2)}% in 24h)`
    ).join('\n');

    // 4. THE BRAIN: Generate the Tweet
    const prompt = `
      You are the official AI agent for "Base Analytics", a Web3 dashboard for the Base Network and Farcaster.
      Here is the live market data for top Base tokens right now:
      ${marketSummary}

      Write a single, highly engaging, and witty tweet summarizing this market movement. 
      - Keep it under 200 characters.
      - Sound like a native Web3 crypto native (use terms like 'bullish', 'onchain', 'Based').
      - End the tweet by telling people to check their Farcaster Neynar score at: base-analytics.vercel.app
      - Do not use hashtags.
    `;

    // Using Gemini 2.5 Flash via OpenAI Compatibility Mode!
    const aiResponse = await openai.chat.completions.create({
      model: 'gemini-2.5-flash', 
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });

    const tweetText = aiResponse.choices[0].message.content?.trim();

    if (!tweetText) throw new Error("AI failed to generate text.");

    // 5. THE VOICE: Post to X
    const { data: createdTweet } = await twitterClient.v2.tweet(tweetText);

    return NextResponse.json({ 
      success: true, 
      message: 'Agent successfully posted to X!',
      tweet: tweetText,
      tweetId: createdTweet.id 
    });

  } catch (error) {
    console.error("Agent Error:", error);
    return NextResponse.json({ success: false, error: 'Agent malfunctioned.' }, { status: 500 });
  }
} 