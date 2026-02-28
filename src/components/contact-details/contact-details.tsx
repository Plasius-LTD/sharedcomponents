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
  teamName?: string;
  companyName?: string;
  addressLines?: string[];
  email?: string;
  website?: string;
  websiteLabel?: string;
  className?: string;
}

const defaultDetails: ContactDetailsData = {
  teamName: "Support Team",
  companyName: "Example Organization",
  addressLines: ["123 Example Street", "Sample City", "Sample Region", "00000"],
  email: "contact@example.com",
  website: "https://example.com",
  websiteLabel: "example.com",
};

function resolveDetails({
  details,
  teamName,
  companyName,
  addressLines,
  email,
  website,
  websiteLabel,
}: ContactDetailsProps): ContactDetailsData {
  return {
    ...defaultDetails,
    ...details,
    teamName: teamName ?? details?.teamName ?? defaultDetails.teamName,
    companyName: companyName ?? details?.companyName ?? defaultDetails.companyName,
    addressLines: addressLines ?? details?.addressLines ?? defaultDetails.addressLines,
    email: email ?? details?.email ?? defaultDetails.email,
    website: website ?? details?.website ?? defaultDetails.website,
    websiteLabel: websiteLabel ?? details?.websiteLabel ?? defaultDetails.websiteLabel,
  };
}

export function ContactDetails(props: ContactDetailsProps) {
  const { className } = props;
  const details = resolveDetails(props);

  return (
    <address className={className}>
      <div>
        For inquiries, please contact:
        <br />
        <br />
        <strong>{details.teamName}</strong>
        <br />
        <strong>{details.companyName}</strong>
        <div>
          {details.addressLines.map((line, index) => (
            <span key={`${line}-${index}`}>
              {line}
              <br />
            </span>
          ))}
        </div>
        <br />
        Email: <a href={`mailto:${details.email}`}>{details.email}</a>
        <br />
        Website:{" "}
        <a href={details.website} target="_blank" rel="noopener noreferrer">
          {details.websiteLabel}
        </a>
      </div>
    </address>
  );
}

export default ContactDetails;
