declare module "*.module.css" {
  const classes: Record<string, string>;
  export default classes;
}

declare module "@plasius/analytics" {
  export interface LocalSpaceAnalyticsEvent {
    component: string;
    action: string;
    label?: string;
    href?: string;
    variant?: string;
    context?: Record<string, unknown>;
    timestamp?: number;
  }

  export interface LocalSpaceAnalyticsConfig {
    source: string;
    endpoint?: string;
    enabled?: boolean;
    defaultContext?: Record<string, unknown>;
    headers?: Record<string, string>;
  }

  export interface LocalSpaceAnalyticsClient {
    readonly source: string;
    track: (event: LocalSpaceAnalyticsEvent) => void;
    flush: () => Promise<void>;
    updateConfig: (config: Partial<LocalSpaceAnalyticsConfig>) => void;
    getConfig: () => Readonly<LocalSpaceAnalyticsConfig>;
    destroy: () => void;
  }

  export function createLocalSpaceAnalyticsClient(
    config: LocalSpaceAnalyticsConfig
  ): LocalSpaceAnalyticsClient;
}
