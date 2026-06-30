import type { Clock } from "./types.ts";

export function systemClock(): Clock {
  return { now: () => new Date() };
}

export function fixedClock(value: string): Clock {
  return { now: () => new Date(value) };
}
