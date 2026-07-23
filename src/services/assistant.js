// AI 助理：把使用者在「AI 助理」頁籤打的訊息，轉發給 Anthropic Claude API 取得回覆。
//
// 需要你自己申請一組 API 金鑰：
//   1. 前往 https://console.anthropic.com 註冊帳號 (採用量計費，非本 App 內建額度)。
//   2. 建立 API Key，貼到 .env 的 ANTHROPIC_API_KEY。
//   3. 重啟伺服器即可使用；未設定金鑰時，這個功能會回傳清楚的提示訊息而不是報錯崩潰。
//
// 這裡只做「最簡單的單輪/多輪對話轉發」，把使用者這支 App 的定位 (生活小幫手：
// 股票資訊、交通旅遊、日記、記帳、聊天、翻譯、生活建議等) 放進 system prompt，
// 讓回覆的語氣貼近這個 App 的助理人設；之後可以依需求擴充成「不同模式」
// (面試練習/翻譯/技術說明等)，只要調整 system prompt 或允許前端傳入不同模式參數即可。

const logger = require('./logger');

const SYSTEM_PROMPT = `你是 LifeHub 這款生活整合 App 內建的 AI 助理，個性親切、有效率。
使用者可能會問你：日常聊天、練習面試、幫忙想怎麼回訊息、分析對話、給不同角度建議、
規劃旅遊行程、安排待辦事項、健身飲食規劃、比較商品、推薦餐廳、找食譜、單位換算、
電腦軟體問題、股票法人買賣分析、新聞整理、技術面/基本面解釋、風險分析、多語言翻譯等。
請用繁體中文回答(除非使用者要求翻譯成其他語言)，語氣自然、簡潔，避免不必要的長篇大論。
如果使用者問的是投資建議，提醒你只能提供參考資訊、不是專業投資建議。`;

function isConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

async function fetchWithTimeout(url, opts = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// history: [{role: 'user'|'assistant', content: string}, ...]，最後一筆是使用者這次的新訊息
async function chat(history) {
  if (!isConfigured()) {
    return {
      isConfigured: false,
      reply:
        '尚未設定 AI 助理的 API 金鑰。請前往 https://console.anthropic.com 申請一組 API Key，' +
        '貼到 .env 的 ANTHROPIC_API_KEY 後重啟伺服器，就可以開始聊天了。',
    };
  }

  const messages = history
    .filter((m) => m && m.content && m.content.trim())
    .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));

  const res = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    logger.error('Anthropic API 呼叫失敗', { status: res.status, body: errText.slice(0, 500) });
    throw new Error(`AI 助理呼叫失敗: HTTP ${res.status}`);
  }
  const json = await res.json();
  const reply = (json.content || []).map((b) => b.text || '').join('\n').trim();
  return { isConfigured: true, reply: reply || '(沒有取得回覆內容)' };
}

function healthcheck() {
  return isConfigured() ? { ok: true } : { ok: false, reason: '未設定 ANTHROPIC_API_KEY' };
}

module.exports = { chat, isConfigured, healthcheck };
