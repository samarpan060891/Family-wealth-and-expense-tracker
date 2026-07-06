import Anthropic from "@anthropic-ai/sdk";
import { extractPdfText, hasUsableText } from "@/lib/pdf-text";
import { spreadsheetToText, isSpreadsheet } from "@/lib/sheet-text";

// Model is configurable so the deployer can trade cost for accuracy.
// Defaults to Claude Haiku 4.5 (cheapest, well-suited to reading bills/statements);
// set EXTRACTION_MODEL=claude-opus-4-8 for higher accuracy on complex documents.
const MODEL = process.env.EXTRACTION_MODEL ?? "claude-haiku-4-5";

export type ExtractModule = "expense" | "income" | "investment" | "debt" | "asset" | "insurance";

export function isExtractionConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

// Each module declares the fields we want lifted off the document. Every field is a nullable
// string in the JSON schema so the model can leave anything it can't find as null; the client
// cleans/parses numbers and only pre-fills what came back.
const MODULE_FIELDS: Record<ExtractModule, { key: string; hint: string }[]> = {
  expense: [
    { key: "amount", hint: "total amount paid / billed, digits only" },
    { key: "date", hint: "transaction or bill date in YYYY-MM-DD" },
    { key: "categoryName", hint: "best-fit spending category, e.g. Electricity, Groceries, Fuel / Transport" },
    { key: "paymentMethod", hint: "one of: cash, debit_card, credit_card, upi, bank_transfer, auto_debit, cheque, dividend, other" },
    { key: "note", hint: "merchant / vendor name and a short description" },
  ],
  income: [
    { key: "amount", hint: "credited amount, digits only" },
    { key: "date", hint: "date in YYYY-MM-DD" },
    { key: "categoryName", hint: "best-fit income category, e.g. Salary, Dividends, Interest, Rental Income" },
    { key: "paymentMethod", hint: "one of: cash, bank_transfer, upi, dividend, cheque, other" },
    { key: "note", hint: "payer name and a short description" },
  ],
  investment: [
    { key: "name", hint: "scheme / fund / instrument name" },
    { key: "type", hint: "e.g. Mutual Fund, Stocks, ETF, Fixed Deposit, Recurring Deposit, FCNR Deposit, PPF, NPS, Gold, Bonds" },
    { key: "investedAmount", hint: "amount invested / principal, digits only" },
    { key: "currentValue", hint: "current / market value if shown, digits only" },
    { key: "purchaseDate", hint: "purchase / start date in YYYY-MM-DD" },
    { key: "maturityDate", hint: "maturity date in YYYY-MM-DD if any" },
  ],
  debt: [
    { key: "name", hint: "loan / account name" },
    { key: "lender", hint: "bank / lender name" },
    { key: "type", hint: "e.g. Home Loan, Personal Loan, Car Loan, Credit Card" },
    { key: "principal", hint: "sanctioned / principal amount, digits only" },
    { key: "outstandingAmount", hint: "current outstanding balance, digits only" },
    { key: "interestRate", hint: "annual interest rate percent, digits only" },
    { key: "emiAmount", hint: "monthly EMI / installment, digits only" },
  ],
  asset: [
    { key: "name", hint: "asset name" },
    { key: "type", hint: "e.g. Real Estate, Vehicle, Gold / Jewellery, Electronics" },
    { key: "value", hint: "current value / price, digits only" },
    { key: "purchaseDate", hint: "purchase date in YYYY-MM-DD" },
  ],
  insurance: [
    { key: "name", hint: "policy / plan name" },
    { key: "type", hint: "e.g. Life Insurance, Term Insurance, Health Insurance, Vehicle Insurance" },
    { key: "provider", hint: "insurer / company name" },
    { key: "policyNumber", hint: "policy number" },
    { key: "premiumAmount", hint: "premium amount, digits only" },
    { key: "startDate", hint: "policy start date in YYYY-MM-DD" },
    { key: "expiryDate", hint: "expiry / renewal date in YYYY-MM-DD" },
    { key: "sumAssured", hint: "sum assured / cover amount, digits only" },
    { key: "nominee", hint: "nominee name" },
    { key: "claimHelpline", hint: "claims / emergency helpline phone number printed on the policy" },
    { key: "insurerHelpline", hint: "general customer-care / toll-free phone number" },
    { key: "agentName", hint: "advisor / agent name if any" },
    { key: "agentPhone", hint: "advisor / agent phone if any" },
  ],
};

export type ExtractResult = {
  fields: Record<string, string | null>;
  configured: boolean;
};

/** Pulls the first JSON object out of the model's reply, tolerating ```json fences or stray prose. */
function parseJsonObject(text: string): Record<string, string | null> {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return {};
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as Record<string, string | null>;
  } catch {
    return {};
  }
}

export async function extractFromDocument(params: {
  module: ExtractModule;
  fileType: string;
  base64: string;
}): Promise<ExtractResult> {
  if (!isExtractionConfigured()) {
    return { fields: {}, configured: false };
  }

  const { module, fileType, base64 } = params;
  const client = new Anthropic();

  const isPdf = fileType === "application/pdf";
  const isImage = fileType.startsWith("image/");
  const isSheet = isSpreadsheet(fileType);
  if (!isPdf && !isImage && !isSheet) {
    return { fields: {}, configured: true };
  }

  const fields = MODULE_FIELDS[module];
  const fieldList = fields.map((f) => `- ${f.key}: ${f.hint}`).join("\n");
  const keys = fields.map((f) => f.key).join(", ");

  // Token-saving layer: read PDFs and spreadsheets to plain text locally and send
  // Claude just the text (much cheaper than a PDF document block or images).
  // Scanned PDFs (no text layer) and photos fall back to vision.
  let contentBlock: Anthropic.Messages.ContentBlockParam;
  if (isSheet) {
    const sheetText = spreadsheetToText(base64);
    if (!hasUsableText(sheetText)) return { fields: {}, configured: true };
    contentBlock = { type: "text", text: `Spreadsheet contents:\n\n${sheetText}` };
  } else if (isPdf) {
    const pdfText = await extractPdfText(base64);
    contentBlock = hasUsableText(pdfText)
      ? { type: "text", text: `Extracted document text:\n\n${pdfText.slice(0, 20000)}` }
      : {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: base64 },
        };
  } else {
    contentBlock = {
      type: "image",
      source: {
        type: "base64",
        media_type: fileType as "image/png" | "image/jpeg" | "image/gif" | "image/webp",
        data: base64,
      },
    };
  }

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          contentBlock,
          {
            type: "text",
            text:
              `This document is a ${module} record (a bill, statement, receipt, or policy). ` +
              `Extract these fields:\n${fieldList}\n\n` +
              `Respond with ONLY a single JSON object whose keys are exactly: ${keys}. ` +
              `Use null (not empty string) for anything not clearly present. ` +
              `Return amounts as plain digits with no currency symbols or thousands separators, and all dates as YYYY-MM-DD. ` +
              `Do not wrap the JSON in markdown or add any commentary.`,
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return { fields: {}, configured: true };
  }
  return { fields: parseJsonObject(textBlock.text), configured: true };
}
