// 機票 + 機加酒比價服務
//
// 現況說明：目前沒有「免費、免申請、可直接拿到即時票價」的公開機票 API。
// 真正能查即時票價/庫存的服務(如 Amadeus、Skyscanner Partner、Google Flights API)
// 都需要企業合作或付費授權。這裡先用「Adapter 介面」設計，未來只要把
// FLIGHT_API_PROVIDER / FLIGHT_API_KEY 設定好、並實作 real() 內容，
// 前端完全不用改，就能從示範資料切換成真實資料。

function isConfigured() {
  return Boolean(process.env.FLIGHT_API_PROVIDER && process.env.FLIGHT_API_KEY);
}

function demoBundle(from, to, date) {
  const base = 2500 + Math.abs(hashCode(from + to)) % 4000;
  return {
    isDemo: true,
    notice: '尚未設定機票/訂房商業 API 金鑰，以下為示範價格區間，非即時真實報價。',
    from,
    to,
    date,
    options: [
      { airline: '示範航空 A', price: base, hotel: '示範飯店 1 晚', hotelPrice: 1800, total: base + 1800 },
      { airline: '示範航空 B', price: base + 600, hotel: '示範飯店 2 晚', hotelPrice: 3200, total: base + 600 + 3200 },
      { airline: '示範航空 C(轉機)', price: base - 400, hotel: '示範民宿 1 晚', hotelPrice: 1200, total: base - 400 + 1200 },
    ].sort((a, b) => a.total - b.total),
  };
}

function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i);
  return h;
}

async function getCheapestBundle(from, to, date) {
  if (!isConfigured()) return demoBundle(from, to, date);
  // TODO: 實作真實 Provider (例如 Amadeus Flight Offers Search + Hotel Search)。
  // 目前尚未設定對應的正式合作，先回傳示範資料並標註原因，避免程式噴錯。
  return { ...demoBundle(from, to, date), notice: '已設定 Provider 但尚未實作串接邏輯，暫用示範資料。' };
}

function healthcheck() {
  return isConfigured()
    ? { ok: true, provider: process.env.FLIGHT_API_PROVIDER }
    : { ok: false, reason: '未設定 FLIGHT_API_PROVIDER / FLIGHT_API_KEY (使用示範資料)' };
}

module.exports = { getCheapestBundle, isConfigured, healthcheck };
