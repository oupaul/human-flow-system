// 系統通知：新的請假/加班申請送出時通知 HR/主管去審核。
// 設定存在資料庫的 notification_settings 表（單一列，id=1），由「設定」頁面
// 維護；首次讀取若資料庫還沒有這筆設定，會用環境變數當初始值建立一筆
// （方便舊版只用 .env 設定的部署直接沿用），之後就以資料庫內容為主。
// 發送失敗都只會記錄一行 log，絕對不會讓申請/審核這類主要業務動作失敗。

import nodemailer from 'nodemailer';

function envDefaults() {
  return {
    channel: process.env.NOTIFICATION_CHANNEL || 'none',
    smtp_host: process.env.SMTP_HOST || null,
    smtp_port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : null,
    smtp_secure: process.env.SMTP_SECURE === 'true',
    smtp_allow_self_signed_cert: process.env.SMTP_ALLOW_SELF_SIGNED_CERT === 'true',
    smtp_from: process.env.SMTP_FROM || null,
    notification_to_emails: process.env.NOTIFICATION_TO_EMAILS || null,
    smtp_auth_method: process.env.SMTP_AUTH_METHOD || 'basic',
    smtp_user: process.env.SMTP_USER || null,
    smtp_password: process.env.SMTP_PASSWORD || null,
    smtp_oauth_user: process.env.SMTP_OAUTH_USER || null,
    smtp_oauth_client_id: process.env.SMTP_OAUTH_CLIENT_ID || null,
    smtp_oauth_client_secret: process.env.SMTP_OAUTH_CLIENT_SECRET || null,
    smtp_oauth_refresh_token: process.env.SMTP_OAUTH_REFRESH_TOKEN || null,
    teams_webhook_url: process.env.TEAMS_WEBHOOK_URL || null,
  };
}

// 取得目前的通知設定；資料庫沒有紀錄時，用環境變數當初始值建立一筆
export async function getNotificationSettings(pool) {
  const [rows] = await pool.execute('SELECT * FROM notification_settings WHERE id = 1');
  if (rows[0]) {
    return rows[0];
  }

  const defaults = envDefaults();
  await pool.execute(
    `INSERT INTO notification_settings
      (id, channel, smtp_host, smtp_port, smtp_secure, smtp_allow_self_signed_cert, smtp_from, notification_to_emails,
       smtp_auth_method, smtp_user, smtp_password, smtp_oauth_user, smtp_oauth_client_id,
       smtp_oauth_client_secret, smtp_oauth_refresh_token, teams_webhook_url)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      defaults.channel, defaults.smtp_host, defaults.smtp_port, defaults.smtp_secure, defaults.smtp_allow_self_signed_cert, defaults.smtp_from,
      defaults.notification_to_emails, defaults.smtp_auth_method, defaults.smtp_user, defaults.smtp_password,
      defaults.smtp_oauth_user, defaults.smtp_oauth_client_id, defaults.smtp_oauth_client_secret,
      defaults.smtp_oauth_refresh_token, defaults.teams_webhook_url,
    ]
  );

  const [newRows] = await pool.execute('SELECT * FROM notification_settings WHERE id = 1');
  return newRows[0];
}

function buildTransporter(settings) {
  const auth = settings.smtp_auth_method === 'oauth2'
    ? {
        type: 'OAuth2',
        user: settings.smtp_oauth_user,
        clientId: settings.smtp_oauth_client_id,
        clientSecret: settings.smtp_oauth_client_secret,
        refreshToken: settings.smtp_oauth_refresh_token,
      }
    : {
        user: settings.smtp_user,
        pass: settings.smtp_password,
      };

  return nodemailer.createTransport({
    host: settings.smtp_host,
    port: settings.smtp_port || 587,
    secure: !!settings.smtp_secure,
    auth,
    // 公司自架郵件伺服器常見自簽憑證或憑證鏈不完整，預設驗證會失敗
    // （unable to get local issuer certificate）；管理員在「系統設定」勾選
    // 「允許自簽憑證」後才會略過驗證，只建議在信任的內部網路環境使用
    tls: { rejectUnauthorized: !settings.smtp_allow_self_signed_cert },
  });
}

async function sendEmail(settings, subject, message, toOverride) {
  const to = toOverride || settings.notification_to_emails;
  if (!to) {
    console.warn('[notifications] 未設定收件信箱，略過寄送 email 通知');
    return;
  }

  const from = settings.smtp_from || settings.smtp_user || settings.smtp_oauth_user;
  const transporter = buildTransporter(settings);
  await transporter.sendMail({ from, to, subject, text: message });
}

// Microsoft Teams「傳入 Webhook」連接器格式（MessageCard）。若貴組織改用較新的
// Power Automate 工作流程 Webhook，payload 格式不同，需自行調整這裡的內容
async function sendTeams(settings, subject, message) {
  if (!settings.teams_webhook_url) {
    console.warn('[notifications] 未設定 Teams Webhook 網址，略過發送通知');
    return;
  }

  const response = await fetch(settings.teams_webhook_url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      summary: subject,
      themeColor: '0078D7',
      title: subject,
      text: message,
    }),
  });

  if (!response.ok) {
    throw new Error(`Teams webhook 回應 ${response.status}`);
  }
}

async function dispatch(settings, subject, message) {
  if (settings.channel === 'smtp') {
    await sendEmail(settings, subject, message);
  } else if (settings.channel === 'teams') {
    await sendTeams(settings, subject, message);
  }
}

// 供業務流程（新申請送出時）呼叫：失敗只記錄 log，絕不拋出例外
export async function sendNotification(pool, subject, message) {
  try {
    const settings = await getNotificationSettings(pool);
    if (settings.channel === 'none') {
      return;
    }
    await dispatch(settings, subject, message);
  } catch (error) {
    console.error('[notifications] 發送通知失敗：', error.message);
  }
}

// 供「設定」頁面的測試按鈕呼叫：失敗要讓呼叫端知道，不吞掉錯誤
export async function sendTestNotification(pool) {
  const settings = await getNotificationSettings(pool);
  if (settings.channel === 'none') {
    throw new Error('尚未選擇通知通道');
  }
  await dispatch(settings, 'HRMS 測試通知', '這是一封測試通知，收到代表通知設定正確。');
}

// 寄給指定收件人（例如員工本人）。Teams Webhook 只能發到固定頻道、無法指定個人，
// 所以只有 SMTP 通道才會寄出；其他通道回傳 false 讓呼叫端知道沒有送達。
// 同樣不拋例外，失敗只記錄 log
export async function sendNotificationToEmail(pool, toEmail, subject, message) {
  try {
    if (!toEmail) return false;
    const settings = await getNotificationSettings(pool);
    if (settings.channel !== 'smtp') return false;
    await sendEmail(settings, subject, message, toEmail);
    return true;
  } catch (error) {
    console.error('[notifications] 寄送個人通知失敗：', error.message);
    return false;
  }
}
