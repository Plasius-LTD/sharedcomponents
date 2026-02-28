import type { SharedComponentsMetadataInput } from "../../metadata/white-label.js";
import { toContactDetailsBranding } from "../../metadata/white-label.js";
import { useSharedComponentsBrandingMetadata } from "../../metadata/provider.js";

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

  return (
    <address className={className}>
      <div>
        For inquiries, please contact:
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
        Email: <a href={`mailto:${resolvedDetails.email}`}>{resolvedDetails.email}</a>
        <br />
        Website:{" "}
        <a href={resolvedDetails.website} target="_blank" rel="noopener noreferrer">
          {resolvedDetails.websiteLabel}
        </a>
      </div>
    </address>
  );
}

export default ContactDetails;
