import { vi } from "vitest";

export const analyticsTrackSpy = vi.fn();
export const analyticsFlushSpy = vi.fn(async () => undefined);
export const analyticsUpdateConfigSpy = vi.fn();
export const analyticsGetConfigSpy = vi.fn(() => ({
  source: "@plasius/sharedcomponents",
}));
export const analyticsDestroySpy = vi.fn();

export const analyticsClientMock = {
  source: "@plasius/sharedcomponents",
  track: analyticsTrackSpy,
  flush: analyticsFlushSpy,
  updateConfig: analyticsUpdateConfigSpy,
  getConfig: analyticsGetConfigSpy,
  destroy: analyticsDestroySpy,
};

export const createAnalyticsClientSpy = vi.fn(() => analyticsClientMock);

export function resetAnalyticsMocks() {
  analyticsTrackSpy.mockClear();
  analyticsFlushSpy.mockClear();
  analyticsUpdateConfigSpy.mockClear();
  analyticsGetConfigSpy.mockClear();
  analyticsDestroySpy.mockClear();
  createAnalyticsClientSpy.mockClear();
}
