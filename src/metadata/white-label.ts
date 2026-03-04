export interface SharedComponentsMetadata {
  organizationName: string;
  website: string;
  websiteLabel: string;
  contactEmail: string;
  contactTeamName: string;
  contactAddressLines: string[];
  analytics: SharedComponentsAnalyticsMetadata;
}

export type SharedComponentsMetadataInput = Partial<SharedComponentsMetadata>;

export interface SharedComponentsAnalyticsMetadata {
  endpoint?: string;
  source?: string;
  enabled?: boolean;
  headers?: Record<string, string>;
  context?: Record<string, unknown>;
}

export interface ContactDetailsBranding {
  teamName: string;
  companyName: string;
  addressLines: string[];
  email: string;
  website: string;
  websiteLabel: string;
}

export interface FooterBranding {
  companyName: string;
  contactEmail: string;
}

export const defaultSharedComponentsAnalyticsMetadata: SharedComponentsAnalyticsMetadata = {
  source: "@plasius/sharedcomponents",
  enabled: true,
  headers: {},
  context: {},
};

export const defaultSharedComponentsMetadata: SharedComponentsMetadata = {
  organizationName: "Example Organization",
  website: "https://example.com",
  websiteLabel: "example.com",
  contactEmail: "contact@example.com",
  contactTeamName: "Support Team",
  contactAddressLines: [
    "123 Example Street",
    "Sample City",
    "Sample Region",
    "00000",
  ],
  analytics: defaultSharedComponentsAnalyticsMetadata,
};

export function resolveSharedComponentsMetadata(
  metadata?: SharedComponentsMetadataInput
): SharedComponentsMetadata {
  const analyticsOverrides = metadata?.analytics;

  return {
    ...defaultSharedComponentsMetadata,
    ...metadata,
    contactAddressLines:
      metadata?.contactAddressLines ?? defaultSharedComponentsMetadata.contactAddressLines,
    analytics: {
      ...defaultSharedComponentsAnalyticsMetadata,
      ...analyticsOverrides,
      headers: {
        ...defaultSharedComponentsAnalyticsMetadata.headers,
        ...(analyticsOverrides?.headers ?? {}),
      },
      context: {
        ...defaultSharedComponentsAnalyticsMetadata.context,
        ...(analyticsOverrides?.context ?? {}),
      },
    },
  };
}

export function toContactDetailsBranding(
  metadata?: SharedComponentsMetadataInput
): ContactDetailsBranding {
  const resolved = resolveSharedComponentsMetadata(metadata);

  return {
    teamName: resolved.contactTeamName,
    companyName: resolved.organizationName,
    addressLines: resolved.contactAddressLines,
    email: resolved.contactEmail,
    website: resolved.website,
    websiteLabel: resolved.websiteLabel,
  };
}

export function toFooterBranding(
  metadata?: SharedComponentsMetadataInput
): FooterBranding {
  const resolved = resolveSharedComponentsMetadata(metadata);

  return {
    companyName: resolved.organizationName,
    contactEmail: resolved.contactEmail,
  };
}
