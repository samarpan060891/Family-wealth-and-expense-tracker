"use client";
import { useEffect, useState } from "react";
import { Modal } from "@/components/ui";
import { AttachmentUploader } from "@/components/attachment-uploader";

type Module = "expense" | "income" | "investment" | "debt" | "asset" | "insurance";

export function RowAttachments({
  module,
  recordId,
  label,
}: {
  module: Module;
  recordId: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/attachments?module=${module}&recordId=${recordId}`)
      .then((r) => r.json())
      .then((d) => setCount((d.attachments ?? []).length))
      .catch(() => setCount(0));
  }, [module, recordId]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1 text-xs transition-colors ${
          count ? "text-accent hover:text-accent-soft" : "text-muted-soft hover:text-text"
        }`}
      >
        📎 {count ? `${count} file${count === 1 ? "" : "s"}` : "Attach"}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Attachments · ${label}`}>
        <AttachmentUploader
          module={module}
          recordId={recordId}
          onChange={(n) => setCount(n)}
        />
      </Modal>
    </>
  );
}
