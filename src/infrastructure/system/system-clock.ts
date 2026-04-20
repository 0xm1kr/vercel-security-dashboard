import type { Clock } from "../../application/ports/clock.js";

export class SystemClock implements Clock {
  now(): number {
    return Date.now();
  }
}
