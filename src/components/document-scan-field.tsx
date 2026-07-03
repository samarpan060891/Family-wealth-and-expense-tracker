"use client";
import { CaptureOrUpload } from "@/components/capture-or-upload";

// Wraps the Capture/Upload control for use inside an add-record form, forwarding
// the picked file to the useDocumentScan hook (which compresses-then-scans for
// auto-fill and keeps the file to attach on save).
export function DocumentScanField({
  label,
  scanning,
  scanNote,
  file,
  onFilePicked,
}: {
  label: string;
  scanning: boolean;
  scanNote: string;
  file: File | null;
  onFilePicked: (file: File | null) => void;
}) {
  return (
    <div>
      <label>{label}</label>
      <CaptureOrUpload
        onSelect={(f) => onFilePicked(f)}
        busy={scanning}
        note={scanning ? "Reading document…" : scanNote || undefined}
        currentName={file?.name ?? null}
      />
    </div>
  );
}
