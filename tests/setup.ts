import { vi } from "vitest";
import { createAnalyticsClientSpy } from "./analytics-mocks.js";

vi.mock("@plasius/analytics", () => ({
  createLocalSpaceAnalyticsClient: createAnalyticsClientSpy,
}));
