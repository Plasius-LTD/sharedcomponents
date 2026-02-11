export interface ContactDetailsProps {
  teamName?: string;
  companyName?: string;
  addressLines?: string[];
  email?: string;
  website?: string;
  websiteLabel?: string;
  className?: string;
}

const defaultAddressLines = [
  "C/O Chalk Hill Barn Office 1,",
  "Yew Tree Farm,",
  "Stone Street,",
  "Stanford,",
  "Kent,",
  "England,",
  "TN25 6DH",
];

export function ContactDetails({
  teamName = "Web Development Team",
  companyName = "Plasius LTD",
  addressLines = defaultAddressLines,
  email = "web@plasius.co.uk",
  website = "https://plasius.co.uk",
  websiteLabel = "https://plasius.co.uk",
  className,
}: ContactDetailsProps) {
  return (
    <address className={className}>
      <div>
        For inquiries, please contact:
        <br />
        <br />
        <strong>{teamName}</strong>
        <br />
        <strong>{companyName}</strong>
        <div>
          {addressLines.map((line, index) => (
            <span key={`${line}-${index}`}>
              {line}
              <br />
            </span>
          ))}
        </div>
        <br />
        Email: <a href={`mailto:${email}`}>{email}</a>
        <br />
        Website:{" "}
        <a href={website} target="_blank" rel="noopener noreferrer">
          {websiteLabel}
        </a>
      </div>
    </address>
  );
}

export default ContactDetails;
