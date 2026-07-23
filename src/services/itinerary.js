// 行程規劃產生器
// 兩層內容：
//   1. 逐日行程草案 — 規則式範本 (TEMPLATES)，之後可再串接地圖/AI 做更個人化的規劃。
//   2. 精選推薦清單 — 針對「已收錄的城市」提供實際整理過的景點/美食/休閒建議 (CURATED_SPOTS)。
//      目前只先收錄「台中」「新北」兩個城市 (使用者最早提到的例子)，內容整理自多篇
//      公開的旅遊/美食部落格文章 (來源已列在 CHANGELOG/README)，不是即時串接 Google 地圖
//      評分 —— 我們沒有 Google Places API 金鑰，所以這裡「刻意不」編造具體的星等分數，
//      只做質化描述 (例如「IG熱門打卡」「在地排隊名店」)，避免用看起來很精確、但其實
//      無法驗證是否為目前真實評分的數字誤導使用者。
//      要規模化到「任何城市都有推薦清單」，正式版需要：
//        (a) 申請 Google Places API / TripAdvisor API 金鑰，即時查詢真實星等與評論，或
//        (b) 持續人工整理更多城市的內容到這份清單裡。
//      兩者都需要額外的時間/預算，這裡先示範資料結構與呈現方式。

const TEMPLATES = [
  '抵達與市區慢步：先辦理入住，於周邊步行探索在地小吃與街景，晚上找一間評價高的餐廳放鬆。',
  '主要景點半日遊：安排 1-2 個代表性景點，中午在景點周邊用餐，下午保留彈性時間逛街或休息。',
  '深度體驗日：安排一項在地體驗活動(手作課程/自然步道/博物館)，感受不同於觀光客路線的一面。',
  '郊區小旅行：搭乘當地大眾運輸前往鄰近郊區或觀景點，來回抓半天到一天時間。',
  '收尾與返程：上午安排輕鬆行程或伴手禮採買，保留充裕時間前往車站/機場。',
];

const CURATED_SPOTS = {
  台中: {
    景點: [
      { name: '彩虹眷村', note: '五顏六色的牆面地板，IG 打卡熱點' },
      { name: '審計368新創聚落', note: '文青風格創意園區，集合特色店家與文創商品' },
      { name: '高美濕地', note: '黃昏必追的夕陽美景，木棧道步道' },
      { name: '台中科博館', note: '展示恐龍等自然科學展品的大型博物館' },
      { name: '薰衣草森林', note: '高海拔山景與四季花卉的休閒園區' },
      { name: '梧棲文化出張所', note: '日治時代派出所改建，濃濃日式風格' },
    ],
    美食: [
      { name: '積木城堡星巴克', note: '純白色旋轉木馬造型的特色門市' },
    ],
    休閒: [
      { name: '自行車文化探索館', note: '互動式自行車主題館，有 VR 體驗與騎乘挑戰' },
      { name: '烏日觀光啤酒廠', note: '免門票參觀台灣啤酒製程與文物館' },
      { name: '泰安落羽松秘境', note: '季節限定紅葉美景，適合秋冬拍照 (季節限定)' },
    ],
  },
  新北: {
    景點: [
      { name: '九份老街', note: '山城風情，適合傍晚時段前往看夜景與山海景' },
      { name: '淡水老街', note: '河岸夕陽與歷史街區，適合悠閒散步' },
    ],
    美食: [
      { name: '暇 咖啡 hima cafe (九份)', note: '絕美九份山城下午茶首選，無敵山海景觀' },
      { name: '九份老麵店 (九份)', note: '飄香傳承65年，九份老街第一家牛肉麵專門店' },
      { name: '彭園 板橋店 (板橋)', note: '融合八大菜系的中式餐廳，傳承一甲子' },
      { name: '瑞芳古早味三輪車割包 (瑞芳)', note: '銅板美食在地排隊名店，傳承超過一甲子' },
      { name: '永新豆漿 竹林總店 (永和)', note: '營業滿43年老字號早餐，鹹豆漿加蛋必點' },
      { name: '沒有特別計畫咖啡 (淡水)', note: '每日限量甜點，文青療癒系咖啡廳' },
    ],
    休閒: [
      { name: 'ABV 地中海餐酒館 (林口)', note: '超過300款精釀啤酒，適合朋友聚會' },
      { name: '初殿鍋物 (新莊)', note: '平日套餐299元起、60種自助吧吃到飽' },
    ],
  },
};

function findCuratedCity(...names) {
  for (const n of names) {
    if (!n) continue;
    const key = Object.keys(CURATED_SPOTS).find((city) => n.includes(city));
    if (key) return { city: key, spots: CURATED_SPOTS[key] };
  }
  return null;
}

function generate(from, to, days) {
  const n = Math.max(1, Math.min(14, Number(days) || 3));
  const plan = [];
  for (let i = 0; i < n; i++) {
    const template = TEMPLATES[Math.min(i, TEMPLATES.length - 1)];
    plan.push({
      day: i + 1,
      title: i === 0 ? `Day 1：${from} 出發抵達 ${to}` : i === n - 1 ? `Day ${i + 1}：${to} 返程` : `Day ${i + 1}：${to} 深度探索`,
      suggestion: template,
    });
  }

  const curated = findCuratedCity(to, from);

  return {
    from,
    to,
    days: n,
    generatedAt: new Date().toISOString(),
    disclaimer: '逐日行程為規則式草案，實際景點/餐廳建議之後可串接地圖與觀光資料庫做更精準的個人化推薦。',
    plan,
    curated: curated
      ? {
          city: curated.city,
          sourceNote: `以下「${curated.city}」推薦整理自多篇公開旅遊/美食部落格文章，非即時 Google 地圖評分 (目前沒有串接 Google Places API)，僅列出質化特色描述。`,
          categories: curated.spots,
        }
      : null,
  };
}

module.exports = { generate, CURATED_SPOTS };
