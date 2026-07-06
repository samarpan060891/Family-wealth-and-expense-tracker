"use client";
import { useEffect, useState } from "react";

type Attachment = { id: string; fileName: string; fileType: string };
type Module = "expense" | "income" | "investment" | "debt" | "asset" | "insurance";

export async function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export type ExtractResponse = {
  configured: boolean;
  fields: Record<string, string | null>;
  message?: string;
  error?: string;
  /** Set by scanDocument when the request itself failed (non-2xx). */
  failed?: boolean;
};

/** Sends a picked document to the server to auto-detect field values. Images, PDFs
 * and spreadsheets (xlsx/xls/csv) are supported; others are skipped. */
export async function scanDocument(module: Module, file: File): Promise<ExtractResponse> {
  const type = file.type || "application/octet-stream";
  const name = file.name.toLowerCase();
  const isSheet = /spreadsheet|excel|csv|ms-excel/i.test(type) || /\.(xlsx|xls|csv)$/.test(name);
  const supported = type.startsWith("image/") || type === "application/pdf" || isSheet;
  if (!supported) {
    return { configured: true, fields: {} };
  }
  const base64 = await fileToBase64(file);
  // Normalize a missing/odd MIME for spreadsheets so the server routes it correctly.
  const fileType = isSheet && !/spreadsheet|excel|csv/i.test(type) ? "text/csv" : type;
  const res = await fetch("/api/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ module, fileType, fileData: base64 }),
  });
  const data = (await res.json().catch(() => ({}))) as Partial<ExtractResponse>;
  // Preserve whether the request itself failed so callers can show the real
  // reason (file too large, API error, etc.) instead of a generic message.
  return {
    configured: data.configured ?? true,
    fields: data.fields ?? {},
    message: data.message,
    error: data.error,
    failed: !res.ok,
  };
}

export async function uploadAttachment(module: Module, recordId: string, file: File) {
  const base64 = await fileToBase64(file);
  const res = await fetch("/api/attachments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      module,
      recordId,
      fileName: file.name,
      fileType: file.type || "application/octet-stream",
      fileData: base64,
    }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error ?? "Upload failed");
  }
}

export function AttachmentUploader({
  module,
  recordId,
  onChange,
}: {
  module: Module;
  recordId: string;
  onChange?: (count: number) => void;
}) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch(`/api/attachments?module=${module}&recordId=${recordId}`);
    const data = await res.json();
    const rows = data.attachments ?? [];
    setAttachments(rows);
    onChange?.(rows.length);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId]);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      await uploadAttachment(module, recordId, file);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function onDelete(id: string) {
    await fetch(`/api/attachments/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="flex flex-col gap-3">
      <label
        className={`!mb-0 !normal-case !tracking-normal !text-sm !font-medium flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl px-4 py-6 cursor-pointer transition-colors text-center ${
          uploading ? "border-border text-muted-soft" : "border-border hover:border-accent/50 hover:bg-accent-glow text-muted"
        }`}
      >
        <span className="text-xl">📎</span>
        <span>
          {uploading ? "Uploading…" : "Upload a bill / statement / policy"}
          <br />
          <span className="text-xs text-muted-soft">PDF, Excel or image</span>
        </span>
        <input
          type="file"
          accept="image/*,.pdf,.xls,.xlsx,.csv"
          disabled={uploading}
          onChange={onFileChange}
          className="hidden"
        />
      </label>
      {error && <div className="text-red text-xs">{error}</div>}
      {attachments.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {attachments.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between bg-surface2 border border-border-soft rounded-xl px-3 py-2.5 text-xs"
            >
              <a href={`/api/attachments/${a.id}`} target="_blank" rel="noreferrer" className="text-accent truncate font-medium">
                {a.fileName}
              </a>
              <button onClick={() => onDelete(a.id)} className="text-muted hover:text-red ml-2 shrink-0">
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
