// General, widely-published emergency / grievance numbers per country, shown as a convenience
// reference on the Insurance page. These are national helplines, not insurer-specific — always
// rely on the claim/helpline numbers stored on each policy first. Verify before an emergency,
// as numbers can change.
export type Helpline = { label: string; number: string };

export const COUNTRY_HELPLINES: Record<string, Helpline[]> = {
  India: [
    { label: "National Emergency", number: "112" },
    { label: "Ambulance", number: "108" },
    { label: "IRDAI Insurance Grievance", number: "155255" },
    { label: "Insurance Ombudsman (Bima Bharosa)", number: "1800-4254-732" },
  ],
  "United States": [
    { label: "Emergency", number: "911" },
    { label: "NAIC Insurance Help", number: "1-866-470-6242" },
  ],
  "United Kingdom": [
    { label: "Emergency", number: "999" },
    { label: "Non-emergency (NHS)", number: "111" },
    { label: "Financial Ombudsman", number: "0800-023-4567" },
  ],
  Canada: [
    { label: "Emergency", number: "911" },
    { label: "Insurance Bureau of Canada", number: "1-844-227-5422" },
  ],
  Australia: [
    { label: "Emergency", number: "000" },
    { label: "Health Direct", number: "1800-022-222" },
    { label: "Financial Complaints (AFCA)", number: "1800-931-678" },
  ],
  UAE: [
    { label: "Police Emergency", number: "999" },
    { label: "Ambulance", number: "998" },
  ],
  Singapore: [
    { label: "Emergency", number: "995" },
    { label: "Police", number: "999" },
  ],
  Other: [{ label: "Local Emergency", number: "112" }],
};

export function helplinesForCountry(country: string): Helpline[] {
  return COUNTRY_HELPLINES[country] ?? COUNTRY_HELPLINES.Other;
}
