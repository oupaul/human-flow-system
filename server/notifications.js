// 系統通知：新的請假/加班申請送出時通知 HR/主管去審核。
// 透過環境變數 NOTIFICATION_CHANNEL 選擇通道（none / smtp / teams），未設定
// 或發送失敗都只會記錄一行 log，絕對不會讓申請/審核這類主要業務動作失敗。
// 詳細設定方式見 API_SETUP_README.md。

import nodemailer from 'nodemailer';

const CHANNEL = process.env.NOTIFICATION_CHANNEL || 'none';

let cachedTransporter = null;

function getTransporter() {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const authMethod = process.env.SMTP_AUTH_METHOD || 'basic';
  const auth = authMethod === 'oauth2'
    ? {
        type: 'OAuth2',
        user: process.env.SMTP_OAUTH_USER,
        clientId: process.env.SMTP_OAUTH_CLIENT_ID,
        clientSecret: process.env.SMTP_OAUTH_CLIENT_SECRET,
        refreshToken: process.env.SMTP_OAUTH_REFRESH_TOKEN,
      }
    : {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      };

  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth,
  });
  return cachedTransporter;
}

async function sendEmail(subject, message) {
  const to = process.env.NOTIFICATION_TO_EMAILS;
  if (!to) {
    console.warn('[notifications] 未設定 NOTIFICATION_TO_EMAILS，略過寄送 email 通知');
    return;
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER || process.env.SMTP_OAUTH_USER;
  const transporter = getTransporter();
  await transporter.sendMail({ from, to, subject, text: message });
}

// Microsoft Teams「傳入 Webhook」連接器格式（MessageCard）。若貴組織改用較新的
// Power Automate 工作流程 Webhook，payload 格式不同，需自行調整這裡的內容
async function sendTeams(subject, message) {
  const webhookUrl = process.env.TEAMS_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn('[notifications] 未設定 TEAMS_WEBHOOK_URL，略過發送 Teams 通知');
    return;
  }

  const response = await fetch(webhookUrl, {
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

export async function sendNotification(subject, message) {
  if (CHANNEL === 'none') {
    return;
  }
  try {
    if (CHANNEL === 'smtp') {
      await sendEmail(subject, message);
    } else if (CHANNEL === 'teams') {
      await sendTeams(subject, message);
    } else {
      console.warn(`[notifications] 未知的 NOTIFICATION_CHANNEL：${CHANNEL}`);
    }
  } catch (error) {
    console.error('[notifications] 發送通知失敗：', error.message);
  }
}
