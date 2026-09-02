export interface NotificationSettings {
  channel: "none" | "smtp" | "teams";
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  smtpAllowSelfSignedCert: boolean;
  smtpFrom: string | null;
  notificationToEmails: string | null;
  smtpAuthMethod: "basic" | "oauth2";
  smtpUser: string | null;
  smtpOauthUser: string | null;
  smtpOauthClientId: string | null;
  hasSmtpPassword: boolean;
  hasSmtpOauthClientSecret: boolean;
  hasSmtpOauthRefreshToken: boolean;
  hasTeamsWebhookUrl: boolean;
}

export interface NotificationSettingsFormData {
  channel: "none" | "smtp" | "teams";
  smtpHost: string;
  smtpPort: string;
  smtpSecure: boolean;
  smtpAllowSelfSignedCert: boolean;
  smtpFrom: string;
  notificationToEmails: string;
  smtpAuthMethod: "basic" | "oauth2";
  smtpUser: string;
  smtpPassword: string;
  smtpOauthUser: string;
  smtpOauthClientId: string;
  smtpOauthClientSecret: string;
  smtpOauthRefreshToken: string;
  teamsWebhookUrl: string;
}
