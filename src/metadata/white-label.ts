export interface SharedComponentsMetadata {
  organizationName: string;
  website: string;
  websiteLabel: string;
  contactEmail: string;
  contactTeamName: string;
  contactAddressLines: string[];
}

export type SharedComponentsMetadataInput = Partial<SharedComponentsMetadata>;

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
};

export function resolveSharedComponentsMetadata(
  metadata?: SharedComponentsMetadataInput
): SharedComponentsMetadata {
  return {
    ...defaultSharedComponentsMetadata,
    ...metadata,
    contactAddressLines:
      metadata?.contactAddressLines ?? defaultSharedComponentsMetadata.contactAddressLines,
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
