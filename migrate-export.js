// 暫時性搬家腳本：由 railway.json 的 startCommand 在服務啟動前執行一次，
// 把完整 SQLite 資料庫（所有使用者的資料）POST 給 GCP VM 上的暫時接收端點。
// 這支檔案刻意放在 repo 根目錄（不在 src/ 底下），因為 src/ 會被 bootstrap-extract
// 從內建 zip 還原覆蓋，根目錄新檔案不受影響。失敗不影響本體服務啟動：
// railway.json 用分號而非 && 接續 node server.js。
// 用不到的時候（搬家確認完成後）只要把 railway.json 的 startCommand 改回
// "node server.js" 即可，這支檔案可以留著供下次搬家使用。
const fs = require('fs');
const https = require('https');

const SECRET = process.env.MIGRATE_SECRET;
const TARGET = process.env.MIGRATE_TARGET_URL || 'https://lifehub-holmes.duckdns.org/__migrate-receive';

function send(buf) {
  return new Promise((resolve) => {
      const req = https.request(
            TARGET,
                  {
                          method: 'POST',
                                  headers: {
                                            'content-type': 'application/octet-stream',
                                                      'content-length': buf.length,
                                                                'x-migrate-secret': SECRET,
                                                                        },
                                                                                timeout: 20000,
                                                                                      },
                                                                                            (res) => {
                                                                                                    console.log('[migrate-export] 回應狀態: ' + res.statusCode);
                                                                                                            res.resume();
                                                                                                                    res.on('end', resolve);
                                                                                                                          }
                                                                                                                              );
                                                                                                                                  req.on('error', (e) => { console.log('[migrate-export] 送出失敗: ' + e.message); resolve(); });
                                                                                                                                      req.on('timeout', () => { req.destroy(); resolve(); });
                                                                                                                                          req.write(buf);
                                                                                                                                              req.end();
                                                                                                                                                });
                                                                                                                                                }
                                                                                                                                                
                                                                                                                                                async function main() {
                                                                                                                                                  if (!SECRET) { console.log('[migrate-export] 未設定 MIGRATE_SECRET，略過搬家匯出。'); return; }
                                                                                                                                                    const { getDb, DB_PATH } = require('./src/services/db');
                                                                                                                                                      try {
                                                                                                                                                          const db = getDb();
                                                                                                                                                              db.exec('PRAGMA wal_checkpoint(FULL)');
                                                                                                                                                                } catch (e) {
                                                                                                                                                                    console.log('[migrate-export] checkpoint 失敗（略過）: ' + e.message);
                                                                                                                                                                      }
                                                                                                                                                                        if (!fs.existsSync(DB_PATH)) { console.log('[migrate-export] 找不到資料庫檔案: ' + DB_PATH); return; }
                                                                                                                                                                          const buf = fs.readFileSync(DB_PATH);
                                                                                                                                                                            console.log('[migrate-export] 讀到資料庫檔案，大小: ' + buf.length + ' bytes，開始傳送...');
                                                                                                                                                                              await send(buf);
                                                                                                                                                                                console.log('[migrate-export] 完成。');
                                                                                                                                                                                }
                                                                                                                                                                                
                                                                                                                                                                                main().catch((e) => console.log('[migrate-export] 未預期錯誤: ' + e.message));
                                                                                                                                                                                
