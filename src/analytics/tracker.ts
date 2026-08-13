import {
  createLocalSpaceAnalyticsClient,
  type LocalSpaceAnalyticsClient,
  type LocalSpaceAnalyticsEvent,
} from "@plasius/analytics";
import type { SharedComponentsMetadata } from "../metadata/white-label.js";

const clientCache = new Map<string, LocalSpaceAnalyticsClient>();

function getCacheKey(metadata: SharedComponentsMetadata): string {
  return JSON.stringify({
    endpoint: metadata.analytics.endpoint ?? "",
    source: metadata.analytics.source ?? "@plasius/sharedcomponents",
    headers: metadata.analytics.headers ?? {},
    context: metadata.analytics.context ?? {},
    organizationName: metadata.organizationName,
    website: metadata.website,
  });
}

function getClient(metadata: SharedComponentsMetadata): LocalSpaceAnalyticsClient | null {
  const analyticsMetadata = metadata.analytics;

  if (analyticsMetadata.enabled === false) {
    return null;
  }

  const endpoint = analyticsMetadata.endpoint?.trim();
  if (!endpoint) {
    return null;
  }

  const cacheKey = getCacheKey(metadata);
  const cachedClient = clientCache.get(cacheKey);

  if (cachedClient) {
    return cachedClient;
  }

  const client = createLocalSpaceAnalyticsClient({
    source: analyticsMetadata.source?.trim() || "@plasius/sharedcomponents",
    endpoint,
    enabled: true,
    headers: analyticsMetadata.headers,
    defaultContext: {
      organizationName: metadata.organizationName,
      website: metadata.website,
      ...(analyticsMetadata.context ?? {}),
    },
  });

  clientCache.set(cacheKey, client);
  return client;
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
