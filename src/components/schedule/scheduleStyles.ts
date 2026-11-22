import { OffType } from "@/types/schedule";

export const OFF_SHORT: Record<OffType, string> = { rest_day: "休", regular_off: "例", national_holiday: "國" };
export const OFF_CLASS: Record<OffType, string> = {
  rest_day: "bg-sky-100 text-sky-800", regular_off: "bg-emerald-100 text-emerald-800", national_holiday: "bg-rose-100 text-rose-800",
};
export const SHIFT_CLASSES = ["bg-amber-100 text-amber-900", "bg-violet-100 text-violet-900", "bg-teal-100 text-teal-900", "bg-orange-100 text-orange-900", "bg-indigo-100 text-indigo-900"];
