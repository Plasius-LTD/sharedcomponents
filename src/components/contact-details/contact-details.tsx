import { useI18n } from "@plasius/translations";
import type { SharedComponentsMetadataInput } from "../../metadata/white-label.js";
import { toContactDetailsBranding } from "../../metadata/white-label.js";
import { useSharedComponentsBrandingMetadata } from "../../metadata/provider.js";
import { trackSharedComponentsInteraction } from "../../analytics/tracker.js";
import {
  createSharedComponentTranslationResolver,
  sharedComponentTranslationKeys,
} from "../../i18n.js";

export interface ContactDetailsData {
  teamName: string;
  companyName: string;
  addressLines: string[];
  email: string;
  website: string;
  websiteLabel: string;
}

export interface ContactDetailsProps {
  details?: Partial<ContactDetailsData>;
  metadata?: SharedComponentsMetadataInput;
  teamName?: string;
  companyName?: string;
  addressLines?: string[];
  email?: string;
  website?: string;
  websiteLabel?: string;
  className?: string;
}

function resolveDetails({
  details,
  teamName,
  companyName,
  addressLines,
  email,
  website,
  websiteLabel,
}: ContactDetailsProps): Partial<ContactDetailsData> {
  return {
    ...details,
    ...(teamName !== undefined ? { teamName } : {}),
    ...(companyName !== undefined ? { companyName } : {}),
    ...(addressLines !== undefined ? { addressLines } : {}),
    ...(email !== undefined ? { email } : {}),
    ...(website !== undefined ? { website } : {}),
    ...(websiteLabel !== undefined ? { websiteLabel } : {}),
  };
}

export function ContactDetails(props: ContactDetailsProps) {
  const { className } = props;
  const { t } = useI18n();
  const translate = createSharedComponentTranslationResolver(t);
  const metadata = useSharedComponentsBrandingMetadata(
    "ContactDetails",
    props.metadata
  );
  const detailsOverrides = resolveDetails(props);
  const metadataDetails = toContactDetailsBranding(metadata);
  const resolvedDetails = {
    ...metadataDetails,
    ...detailsOverrides,
  };

  const trackInteraction = (
    action: string,
    details: { label: string; href: string; variant?: string }
  ) => {
    trackSharedComponentsInteraction(metadata, {
      component: "ContactDetails",
      action,
      label: details.label,
      href: details.href,
      variant: details.variant,
    });
  };

  return (
    <address className={className}>
      <div>
        {translate(sharedComponentTranslationKeys.contactDetails.inquiries)}
        <br />
        <br />
        <strong>{resolvedDetails.teamName}</strong>
        <br />
        <strong>{resolvedDetails.companyName}</strong>
        <div>
          {resolvedDetails.addressLines.map((line, index) => (
            <span key={`${line}-${index}`}>
              {line}
              <br />
            </span>
          ))}
        </div>
        <br />
        {translate(sharedComponentTranslationKeys.contactDetails.emailLabel)}{" "}
        <a
          href={`mailto:${resolvedDetails.email}`}
          onClick={() =>
            trackInteraction("email_click", {
              label: resolvedDetails.email,
              href: `mailto:${resolvedDetails.email}`,
            })
          }
        >
          {resolvedDetails.email}
        </a>
        <br />
        {translate(sharedComponentTranslationKeys.contactDetails.websiteLabel)}{" "}
        <a
          href={resolvedDetails.website}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() =>
            trackInteraction("website_click", {
              label: resolvedDetails.websiteLabel,
              href: resolvedDetails.website,
            })
          }
        >
          {resolvedDetails.websiteLabel}
        </a>
      </div>
    </address>
  );
}

export default ContactDetails;
