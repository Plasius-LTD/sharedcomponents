import {
  createLocalSpaceAnalyticsClient,
  type LocalSpaceAnalyticsClient,
  type LocalSpaceAnalyticsEvent,
} from "@plasius/analytics";
import type { SharedComponentsMetadata } from "../metadata/white-label.js";

const clientCache = new Map<string, LocalSpaceAnalyticsClient>();
const isolatedFooterFeedbackStorageKey =
  "@plasius/sharedcomponents:footer-feedback-actions:v1";

type AnalyticsContextPolicy = "default" | "isolated-footer-feedback";

function getCacheKey(
  metadata: SharedComponentsMetadata,
  contextPolicy: AnalyticsContextPolicy,
): string {
  if (contextPolicy === "isolated-footer-feedback") {
    return JSON.stringify({
      contextPolicy,
      endpoint: metadata.analytics.endpoint ?? "",
      source: metadata.analytics.source ?? "@plasius/sharedcomponents",
      headers: metadata.analytics.headers ?? {},
    });
  }

  return JSON.stringify({
    contextPolicy,
    endpoint: metadata.analytics.endpoint ?? "",
    source: metadata.analytics.source ?? "@plasius/sharedcomponents",
    headers: metadata.analytics.headers ?? {},
    context: metadata.analytics.context ?? {},
    organizationName: metadata.organizationName,
    website: metadata.website,
  });
}

function getClient(
  metadata: SharedComponentsMetadata,
  contextPolicy: AnalyticsContextPolicy = "default",
): LocalSpaceAnalyticsClient | null {
  const analyticsMetadata = metadata.analytics;

  if (analyticsMetadata.enabled === false) {
    return null;
  }

  const endpoint = analyticsMetadata.endpoint?.trim();
  if (!endpoint) {
    return null;
  }

  const cacheKey = getCacheKey(metadata, contextPolicy);
  const cachedClient = clientCache.get(cacheKey);

  if (cachedClient) {
    return cachedClient;
  }

  const isolatedFooterFeedback =
    contextPolicy === "isolated-footer-feedback";
  const client = createLocalSpaceAnalyticsClient({
    source: analyticsMetadata.source?.trim() || "@plasius/sharedcomponents",
    endpoint,
    enabled: true,
    headers: analyticsMetadata.headers,
    defaultContext: isolatedFooterFeedback
      ? {}
      : {
          organizationName: metadata.organizationName,
          website: metadata.website,
          ...(analyticsMetadata.context ?? {}),
        },
    ...(isolatedFooterFeedback
      ? {
          injectChannelContext: false,
          storageKey: isolatedFooterFeedbackStorageKey,
        }
      : {}),
  });

  clientCache.set(cacheKey, client);
  return client;
}

/**
 * Sends the fixed footer-feedback intent event without host, route, label, or
 * automatically injected channel context. This boundary is intentionally not
 * a general-purpose arbitrary-context API.
 */
export function trackSharedComponentsFooterFeedbackInteraction(
  metadata: SharedComponentsMetadata,
  variant: "desktop" | "mobile",
): void {
  const client = getClient(metadata, "isolated-footer-feedback");
  if (!client) {
    return;
  }

  client.track({
    component: "Footer",
    action: "feedback_open",
    variant,
  });
}

export function trackSharedComponentsInteraction(
  metadata: SharedComponentsMetadata,
  event: LocalSpaceAnalyticsEvent
): void {
  const client = getClient(metadata);
  if (!client) {
    return;
  }

  client.track(event);
}

export function __resetSharedComponentsAnalyticsClientsForTests(): void {
  for (const client of clientCache.values()) {
    client.destroy();
  }
  clientCache.clear();
}
