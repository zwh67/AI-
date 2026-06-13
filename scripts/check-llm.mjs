const apiKey = process.env.OPENAI_API_KEY;
const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

if (!apiKey) {
  console.error("OPENAI_API_KEY is not set.");
  process.exit(1);
}

const response = await fetch(`${baseUrl}/chat/completions`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model,
    messages: [
      { role: "system", content: "你只输出严格 JSON。" },
      { role: "user", content: '返回 {"ok":true,"actions":[{"type":"draw_box","text":"测试"}]}' },
    ],
    temperature: 0,
  }),
});

const body = await response.text();
if (!response.ok) {
  console.error(`LLM request failed: ${response.status}`);
  console.error(body);
  process.exit(1);
}

console.log(`LLM request ok: ${response.status}`);
console.log(body);
