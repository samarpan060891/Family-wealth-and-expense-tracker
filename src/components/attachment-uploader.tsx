"use client";
import { useEffect, useState } from "react";

type Attachment = { id: string; fileName: string; fileType: string };

export function AttachmentUploader({
  module,
  recordId,
}: {
  module: "expense" | "income" | "investment" | "debt" | "asset" | "insurance";
  recordId: string;
}) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch(`/api/attachments?module=${module}&recordId=${recordId}`);
    const data = await res.json();
    setAttachments(data.attachments ?? []);
  }

  useEffect(() => {
    load();
  }, [recordId]);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
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
        setError(data.error ?? "Upload failed");
      } else {
        load();
      }
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
    <div className="flex flex-col gap-2">
      <label className="!mb-0">Attach bill / statement / photo (image, PDF or Excel)</label>
      <input
        type="file"
        accept="image/*,.pdf,.xls,.xlsx,.csv"
        capture="environment"
        disabled={uploading}
        onChange={onFileChange}
      />
      {uploading && <div className="text-xs text-muted">Uploading...</div>}
      {error && <div className="text-red text-xs">{error}</div>}
      {attachments.length > 0 && (
        <div className="flex flex-col gap-1 mt-1">
          {attachments.map((a) => (
            <div key={a.id} className="flex items-center justify-between bg-surface2 rounded-lg px-3 py-2 text-xs">
              <a href={`/api/attachments/${a.id}`} target="_blank" rel="noreferrer" className="text-accent truncate">
                {a.fileName}
              </a>
              <button onClick={() => onDelete(a.id)} className="text-muted hover:text-red ml-2">
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
