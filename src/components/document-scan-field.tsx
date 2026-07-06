"use client";

// A simple file upload used inside the add-record forms. Picks a bill / statement
// / policy (PDF, Excel or image) and forwards it to the useDocumentScan hook,
// which reads it for auto-fill and keeps it to attach on save.
export function DocumentScanField({
  label,
  scanning,
  scanNote,
  file,
  onFilePicked,
  saveToLibrary,
  onSaveToLibraryChange,
}: {
  label: string;
  scanning: boolean;
  scanNote: string;
  file: File | null;
  onFilePicked: (file: File | null) => void;
  // When provided, shows a "also save to Documents" checkbox once a file is picked.
  saveToLibrary?: boolean;
  onSaveToLibraryChange?: (v: boolean) => void;
}) {
  return (
    <div>
      <label>{label}</label>
      <label className="!mb-0 !normal-case !tracking-normal !text-sm !font-medium flex items-center gap-2 border-2 border-dashed border-border hover:border-accent/50 hover:bg-accent-glow rounded-xl px-3 py-2.5 cursor-pointer transition-colors text-muted">
        <span>{scanning ? "⏳" : "📎"}</span>
        <span className="truncate">
          {scanning ? "Reading document…" : file ? file.name : "Upload a bill / statement (PDF, Excel or image)"}
        </span>
        <input
          type="file"
          accept="image/*,.pdf,.xls,.xlsx,.csv"
          onChange={(e) => onFilePicked(e.target.files?.[0] ?? null)}
          className="hidden"
        />
      </label>
      {scanNote && <div className="text-xs text-accent mt-1.5">{scanNote}</div>}
      {file && onSaveToLibraryChange && (
        <label className="!mb-0 !normal-case !tracking-normal !text-xs !font-normal flex items-center gap-2 mt-2 cursor-pointer text-muted">
          <input
            type="checkbox"
            checked={!!saveToLibrary}
            onChange={(e) => onSaveToLibraryChange(e.target.checked)}
            className="!w-auto accent-[var(--accent)]"
          />
          Also save a copy to my Documents library
        </label>
      )}
    </div>
  );
}
