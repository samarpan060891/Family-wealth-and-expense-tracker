"use client";
import { useRef, useState } from "react";
import { scanDocument, fileToBase64 } from "@/components/attachment-uploader";

type Module = "expense" | "income" | "investment" | "debt" | "asset" | "insurance";

/**
 * Shared "pick a document → auto-fill the form" behavior for the module add-forms.
 * The caller supplies `apply`, which maps the extracted fields onto its own form state.
 *
 * Also offers to keep a copy in the standalone Documents library: when
 * `saveToLibrary` is on, call `saveToDocuments(title, category)` on submit.
 */
export function useDocumentScan(module: Module, apply: (fields: Record<string, string | null>) => void) {
  const [file, setFile] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState("");
  const [saveToLibrary, setSaveToLibrary] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setFile(null);
    setScanNote("");
    setSaveToLibrary(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function onFilePicked(picked: File | null) {
    setFile(picked);
    setScanNote("");
    if (!picked) return;
    setScanning(true);
    try {
      const res = await scanDocument(module, picked);
      if (res.configured === false) {
        setScanNote("Attached. (Auto-detect is off — set ANTHROPIC_API_KEY to read documents.)");
        return;
      }
      // The request itself failed (too large, API error, etc.) — show why.
      if (res.failed) {
        setScanNote(`${res.error ?? "Couldn't read this file"} — you can still fill it in manually.`);
        return;
      }
      const fields = res.fields ?? {};
      apply(fields);
      const got = Object.values(fields).filter(Boolean).length;
      // The server may report the file was stored but couldn't be auto-read.
      setScanNote(
        res.note
          ? res.note
          : got
            ? "Scanned the document and pre-filled what we could — please review."
            : "Couldn't find matching details in this file — please fill them in."
      );
    } catch {
      setScanNote("Couldn't scan this file — you can still fill it in manually.");
    } finally {
      setScanning(false);
    }
  }

  /** If the user opted in, save a copy of the picked file to the Documents library. */
  async function saveToDocuments(title: string, category: string) {
    if (!file || !saveToLibrary) return;
    try {
      const base64 = await fileToBase64(file);
      await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || file.name.replace(/\.[^.]+$/, ""),
          category,
          fileName: file.name,
          fileType: file.type || "application/octet-stream",
          fileData: base64,
        }),
      });
    } catch {
      // Non-fatal: the record + its attachment are already saved.
    }
  }

  return {
    file,
    setFile,
    scanning,
    scanNote,
    fileInputRef,
    onFilePicked,
    reset,
    saveToLibrary,
    setSaveToLibrary,
    saveToDocuments,
  };
}
