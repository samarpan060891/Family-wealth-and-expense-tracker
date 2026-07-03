"use client";
import { useEffect, useRef, useState } from "react";
import { compressImage } from "@/lib/image-compress";

// Two clearly separated actions — "Capture Photo" (opens the camera) and
// "Upload File" (opens the file browser for PDF/Excel/images) — plus a review
// step so a captured photo can be retaken before it's used. Images are
// compressed before they leave this component, so both auto-fill scanning and
// storage get the smaller file.

type Props = {
  /** Called with the final (compressed, if image) file the user confirms. */
  onSelect: (file: File) => void | Promise<void>;
  /** Disable inputs while a parent operation (scan/upload) is in flight. */
  busy?: boolean;
  /** Status text shown under the buttons (e.g. scan result). */
  note?: string;
  /** Currently selected file name, shown as a chip. */
  currentName?: string | null;
};

export function CaptureOrUpload({ onSelect, busy, note, currentName }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preparing, setPreparing] = useState(false);
  const [review, setReview] = useState<{ file: File; url: string } | null>(null);

  // Release object URLs to avoid leaks.
  useEffect(() => {
    return () => {
      if (review) URL.revokeObjectURL(review.url);
    };
  }, [review]);

  async function handlePicked(file: File | null, fromCamera: boolean) {
    if (!file) return;
    setPreparing(true);
    try {
      if (file.type.startsWith("image/")) {
        const compressed = await compressImage(file);
        // Photos from the camera get a review step; images picked from the
        // library are shown for review too so the user can confirm.
        const url = URL.createObjectURL(compressed);
        setReview({ file: compressed, url });
      } else {
        // PDF / Excel / CSV — nothing to preview, hand it straight over.
        await onSelect(file);
      }
    } finally {
      setPreparing(false);
      // Reset inputs so re-picking the same file fires onChange again.
      if (cameraRef.current) cameraRef.current.value = "";
      if (fileRef.current) fileRef.current.value = "";
    }
    void fromCamera;
  }

  async function useReviewed() {
    if (!review) return;
    const file = review.file;
    URL.revokeObjectURL(review.url);
    setReview(null);
    await onSelect(file);
  }

  function retake() {
    if (review) URL.revokeObjectURL(review.url);
    setReview(null);
    cameraRef.current?.click();
  }

  const disabled = busy || preparing;

  if (review) {
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-xl overflow-hidden border border-border bg-surface2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={review.url} alt="Captured preview" className="w-full max-h-72 object-contain bg-black/20" />
        </div>
        <div className="text-xs text-muted-soft text-center">
          {(review.file.size / 1024).toFixed(0)} KB · ready to attach
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={retake}
            disabled={disabled}
            className="flex-1 text-sm font-semibold border border-border text-muted hover:text-text hover:bg-surface2 rounded-xl py-2.5 transition-colors disabled:opacity-50"
          >
            ↺ Retake
          </button>
          <button
            type="button"
            onClick={useReviewed}
            disabled={disabled}
            className="flex-1 text-sm font-semibold bg-accent text-black rounded-xl py-2.5 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {disabled ? "Working…" : "✓ Use photo"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          disabled={disabled}
          className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-border hover:border-accent/50 hover:bg-accent-glow rounded-xl py-4 text-muted transition-colors disabled:opacity-50"
        >
          <span className="text-xl">📷</span>
          <span className="text-sm font-medium">{preparing ? "Preparing…" : "Capture Photo"}</span>
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
          className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-border hover:border-accent/50 hover:bg-accent-glow rounded-xl py-4 text-muted transition-colors disabled:opacity-50"
        >
          <span className="text-xl">📎</span>
          <span className="text-sm font-medium">Upload File</span>
          <span className="text-[10px] text-muted-soft">PDF · Excel · Image</span>
        </button>
      </div>

      {currentName && (
        <div className="text-xs text-accent truncate">Selected: {currentName}</div>
      )}
      {note && <div className="text-xs text-accent">{note}</div>}

      {/* Camera: accept only images + capture hint so phones open the rear camera. */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handlePicked(e.target.files?.[0] ?? null, true)}
      />
      {/* File browser: no capture attribute, so PDFs/Excel can be chosen. */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*,.pdf,.xls,.xlsx,.csv"
        className="hidden"
        onChange={(e) => handlePicked(e.target.files?.[0] ?? null, false)}
      />
    </div>
  );
}
