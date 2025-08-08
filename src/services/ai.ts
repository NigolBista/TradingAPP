import Constants from "expo-constants";

export interface InsightRequest {
  symbols: string[];
  skillLevel: string;
  traderType: string;
  timeframe: "today" | "week" | "month";
}

export async function generateInsights(req: InsightRequest): Promise<string> {
  const { openaiApiKey } = (Constants.expoConfig?.extra || {}) as any;
  if (!openaiApiKey) return "AI not configured.";

  const prompt = `You are an investment research assistant. Summarize latest context for ${req.symbols.join(
    ", "
  )}.
  Return:\n- Sentiment (bullish/bearish/neutral) with 1-2 reasons\n- Action: Buy/Sell/Hold for a ${
    req.traderType
  }\n- Risk/Reward with rough ratio and major risks\n- Outlook for ${
    req.timeframe
  }.\nKeep it concise in 6-8 bullet points. Not financial advice.`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You write crisp, actionable market insights.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.5,
      }),
    });
    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content?.trim();
    return text || "No insight generated.";
  } catch (e) {
    return "AI request failed.";
  }
}
