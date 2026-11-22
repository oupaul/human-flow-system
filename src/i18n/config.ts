import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import zhTWCommon from "./locales/zh-TW/common.json";
import zhTWAuth from "./locales/zh-TW/auth.json";
import zhTWDashboard from "./locales/zh-TW/dashboard.json";
import zhTWEmployees from "./locales/zh-TW/employees.json";
import zhTWDepartments from "./locales/zh-TW/departments.json";
import zhTWLeaveManagement from "./locales/zh-TW/leaveManagement.json";
import zhTWMyPortal from "./locales/zh-TW/myPortal.json";
import zhTWSettings from "./locales/zh-TW/settings.json";
import zhTWAccounts from "./locales/zh-TW/accounts.json";
import zhTWReports from "./locales/zh-TW/reports.json";
import zhTWSeniorityBenefits from "./locales/zh-TW/seniorityBenefits.json";
import zhTWPayroll from "./locales/zh-TW/payroll.json";
import zhTWPunch from "./locales/zh-TW/punch.json";
import zhTWSchedule from "./locales/zh-TW/schedule.json";

import enCommon from "./locales/en/common.json";
import enAuth from "./locales/en/auth.json";
import enDashboard from "./locales/en/dashboard.json";
import enEmployees from "./locales/en/employees.json";
import enDepartments from "./locales/en/departments.json";
import enLeaveManagement from "./locales/en/leaveManagement.json";
import enMyPortal from "./locales/en/myPortal.json";
import enSettings from "./locales/en/settings.json";
import enAccounts from "./locales/en/accounts.json";
import enReports from "./locales/en/reports.json";
import enSeniorityBenefits from "./locales/en/seniorityBenefits.json";
import enPayroll from "./locales/en/payroll.json";
import enPunch from "./locales/en/punch.json";
import enSchedule from "./locales/en/schedule.json";

import jaCommon from "./locales/ja/common.json";
import jaAuth from "./locales/ja/auth.json";
import jaDashboard from "./locales/ja/dashboard.json";
import jaEmployees from "./locales/ja/employees.json";
import jaDepartments from "./locales/ja/departments.json";
import jaLeaveManagement from "./locales/ja/leaveManagement.json";
import jaMyPortal from "./locales/ja/myPortal.json";
import jaSettings from "./locales/ja/settings.json";
import jaAccounts from "./locales/ja/accounts.json";
import jaReports from "./locales/ja/reports.json";
import jaSeniorityBenefits from "./locales/ja/seniorityBenefits.json";
import jaPayroll from "./locales/ja/payroll.json";
import jaPunch from "./locales/ja/punch.json";
import jaSchedule from "./locales/ja/schedule.json";

export const SUPPORTED_LANGUAGES = [
  { code: "zh-TW", labelKey: "language.zhTW" },
  { code: "en", labelKey: "language.en" },
  { code: "ja", labelKey: "language.ja" },
] as const;

const resources = {
  "zh-TW": {
    common: zhTWCommon,
    auth: zhTWAuth,
    dashboard: zhTWDashboard,
    employees: zhTWEmployees,
    departments: zhTWDepartments,
    leaveManagement: zhTWLeaveManagement,
    myPortal: zhTWMyPortal,
    settings: zhTWSettings,
    accounts: zhTWAccounts,
    reports: zhTWReports,
    seniorityBenefits: zhTWSeniorityBenefits,
    payroll: zhTWPayroll,
    punch: zhTWPunch,
    schedule: zhTWSchedule,
  },
  en: {
    common: enCommon,
    auth: enAuth,
    dashboard: enDashboard,
    employees: enEmployees,
    departments: enDepartments,
    leaveManagement: enLeaveManagement,
    myPortal: enMyPortal,
    settings: enSettings,
    accounts: enAccounts,
    reports: enReports,
    seniorityBenefits: enSeniorityBenefits,
    payroll: enPayroll,
    punch: enPunch,
    schedule: enSchedule,
  },
  ja: {
    common: jaCommon,
    auth: jaAuth,
    dashboard: jaDashboard,
    employees: jaEmployees,
    departments: jaDepartments,
    leaveManagement: jaLeaveManagement,
    myPortal: jaMyPortal,
    settings: jaSettings,
    accounts: jaAccounts,
    reports: jaReports,
    seniorityBenefits: jaSeniorityBenefits,
    payroll: jaPayroll,
    punch: jaPunch,
    schedule: jaSchedule,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "zh-TW",
    supportedLngs: ["zh-TW", "en", "ja"],
    defaultNS: "common",
    ns: ["common", "auth", "dashboard", "employees", "departments", "leaveManagement", "myPortal", "settings", "accounts", "reports", "seniorityBenefits", "payroll", "punch", "schedule"],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "hrms_language",
    },
  });

export default i18n;
