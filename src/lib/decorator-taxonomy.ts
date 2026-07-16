export const EVENT_TYPE_OPTIONS = [
  "Wesele",
  "Urodziny",
  "Baby shower",
  "Event firmowy",
  "Wieczór panieński",
  "Komunia",
  "Chrzest",
] as const;

export const DECORATION_STYLE_OPTIONS = [
  "Boho",
  "Klasyczny",
  "Rustykalny",
  "Nowoczesny",
  "Glamour",
  "Minimalistyczny",
  "Vintage",
] as const;

export type EventTypeOption = (typeof EVENT_TYPE_OPTIONS)[number];
export type DecorationStyleOption = (typeof DECORATION_STYLE_OPTIONS)[number];

const eventTypeSet = new Set<string>(EVENT_TYPE_OPTIONS);
const decorationStyleSet = new Set<string>(DECORATION_STYLE_OPTIONS);

export function isValidEventType(value: string): value is EventTypeOption {
  return eventTypeSet.has(value);
}

export function isValidDecorationStyle(value: string): value is DecorationStyleOption {
  return decorationStyleSet.has(value);
}
