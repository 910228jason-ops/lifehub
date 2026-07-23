// 產生「各家公司/比價網站」的深連結 (deep link)：直接把使用者要查的出發地/目的地/日期
// 帶入對方網站自己的搜尋網址規則，點下去就會打開該網站、幫忙帶好搜尋條件。
//
// v0.4.0 修正說明 (回應「點過去會跳錯誤」的問題)：
//   1. Skyscanner 正確格式是 /transport/flights/{機場代碼}/{機場代碼}/{yymmdd}/，
//      要用 IATA 機場代碼(小寫)，不能塞中文字，之前用 ?query=中文 會導去錯誤頁。
//      因此加了下面的 CITY_IATA 對照表；查得到代碼才給 Skyscanner 預填連結。
//   2. 長榮官網的 /zh-tw/booking/ 路徑已經 404 (實測確認)，改連 /zh-tw/index.html。
//   3. 航空公司官網 (長榮/華航/虎航) 沒有公開的「帶參數直接進訂票流程」網址規則，
//      這是他們刻意的設計 (要商業合作才給 API)，所以官網連結會誠實標示
//      prefill: false =「開啟官網後需自行輸入」，前端要顯示對應提示，不騙使用者。
//   4. 訂房網站同理：Booking.com 的 ss= 參數是穩定可預填的；Agoda 用 textToSearch
//      參數；Trip.com/AsiaYo 沒有可靠的公開預填規則，標示 prefill: false。
//   未來若對方改版網址規則，連結仍可能失效；真正穩定的深度整合需走商業合作 API。

// 常用城市/機場 中文名 → IATA 代碼對照表 (Skyscanner 用小寫)
const CITY_IATA = {
  台北: 'tpe', 臺北: 'tpe', 桃園: 'tpe', 松山: 'tsa',
  高雄: 'khh', 台中: 'rmq', 臺中: 'rmq', 台南: 'tnn', 花蓮: 'hun', 澎湖: 'mzg', 金門: 'knh',
  東京: 'nrt', 成田: 'nrt', 羽田: 'hnd', 大阪: 'kix', 關西: 'kix', 京都: 'kix',
  名古屋: 'ngo', 福岡: 'fuk', 札幌: 'cts', 沖繩: 'oka', 那霸: 'oka', 廣島: 'hij', 仙台: 'sdj',
  首爾: 'icn', 仁川: 'icn', 釜山: 'pus', 濟州: 'cju',
  香港: 'hkg', 澳門: 'mfm',
  上海: 'pvg', 北京: 'pek', 廣州: 'can', 深圳: 'szx', 廈門: 'xmn', 成都: 'tfu',
  曼谷: 'bkk', 清邁: 'cnx', 普吉: 'hkt', 新加坡: 'sin', 吉隆坡: 'kul',
  峇里島: 'dps', 巴里島: 'dps', 雅加達: 'cgk', 馬尼拉: 'mnl', 宿霧: 'ceb',
  胡志明: 'sgn', 河內: 'han', 峴港: 'dad',
  洛杉磯: 'lax', 舊金山: 'sfo', 紐約: 'jfk', 西雅圖: 'sea', 溫哥華: 'yvr', 多倫多: 'yyz',
  倫敦: 'lhr', 巴黎: 'cdg', 法蘭克福: 'fra', 阿姆斯特丹: 'ams', 羅馬: 'fco',
  雪梨: 'syd', 墨爾本: 'mel', 杜拜: 'dxb', 關島: 'gum', 帛琉: 'ror',
};

function findIata(cityName) {
  if (!cityName) return null;
  const key = Object.keys(CITY_IATA).find((k) => cityName.includes(k));
  return key ? CITY_IATA[key] : null;
}

function fmtDate(d) {
  // 期望輸入 YYYY-MM-DD，若使用者沒填就用今天
  if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function flightProviders(from, to, date) {
  const d = fmtDate(date);
  const yymmdd = d.slice(2).replace(/-/g, '');
  const enc = encodeURIComponent;
  const fromIata = findIata(from);
  const toIata = findIata(to);

  const providers = [
    {
      name: 'Google 航班',
      note: '整合多家航空公司時刻與價格，支援中文地名搜尋',
      prefill: true,
      url: `https://www.google.com/travel/flights?q=${enc(`從 ${from} 到 ${to} ${d} 的航班`)}`,
    },
  ];

  if (fromIata && toIata) {
    providers.push({
      name: 'Skyscanner 比價',
      note: `第三方比價 (已帶入 ${fromIata.toUpperCase()} → ${toIata.toUpperCase()} ${d})`,
      prefill: true,
      url: `https://www.skyscanner.com.tw/transport/flights/${fromIata}/${toIata}/${yymmdd}/?adultsv2=1&cabinclass=economy&rtn=0&preferdirects=false`,
    });
  } else {
    providers.push({
      name: 'Skyscanner 比價',
      note: '這組城市不在內建機場代碼對照表，開啟後請自行輸入 (之後可再擴充對照表)',
      prefill: false,
      url: 'https://www.skyscanner.com.tw/',
    });
  }

  providers.push(
    {
      name: '長榮航空 EVA Air',
      note: '官網不提供帶入條件的公開網址，開啟後請自行輸入日期與航點',
      prefill: false,
      url: 'https://www.evaair.com/zh-tw/index.html',
    },
    {
      name: '中華航空 China Airlines',
      note: '官網不提供帶入條件的公開網址，開啟後請自行輸入日期與航點',
      prefill: false,
      url: 'https://www.china-airlines.com/tw/zh',
    },
    {
      name: '台灣虎航 Tigerair',
      note: '廉航；官網開啟後請自行輸入日期與航點',
      prefill: false,
      url: 'https://www.tigerairtw.com/zh-tw',
    }
  );
  return providers;
}

function hotelProviders(city, checkin, checkout) {
  const d1 = fmtDate(checkin);
  const d2 = fmtDate(checkout) === d1 ? addDays(d1, 1) : fmtDate(checkout);
  const enc = encodeURIComponent;
  return [
    {
      name: 'Booking.com',
      note: `已帶入 ${city}、入住 ${d1} / 退房 ${d2}`,
      prefill: true,
      url: `https://www.booking.com/searchresults.zh-tw.html?ss=${enc(city)}&checkin=${d1}&checkout=${d2}&group_adults=2`,
    },
    {
      name: 'Agoda',
      note: `已帶入 ${city} 與日期 (若對方改版可能需重新輸入)`,
      prefill: true,
      url: `https://www.agoda.com/zh-tw/search?textToSearch=${enc(city)}&checkIn=${d1}&checkOut=${d2}`,
    },
    {
      name: 'Trip.com',
      note: '無公開可靠的預填網址規則，開啟後請自行輸入城市與日期',
      prefill: false,
      url: 'https://tw.trip.com/hotels/',
    },
    {
      name: 'AsiaYo',
      note: '台灣/亞洲民宿平台；開啟後請自行輸入城市與日期',
      prefill: false,
      url: 'https://asiayo.com/zh-tw/',
    },
  ];
}

function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

module.exports = { flightProviders, hotelProviders, findIata, CITY_IATA };
