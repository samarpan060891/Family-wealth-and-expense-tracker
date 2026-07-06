"use client";
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, EmptyState, Modal, PageHeader, StatCard } from "@/components/ui";
import { useToast } from "@/components/toast";

type Doc = {
  id: string;
  title: string;
  category: string;
  note: string | null;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
};

const CATEGORIES = [
  { value: "tax", label: "Tax", icon: "🧾" },
  { value: "insurance", label: "Insurance", icon: "🛡" },
  { value: "property", label: "Property", icon: "🏠" },
  { value: "identity", label: "Identity / KYC", icon: "🪪" },
  { value: "bank", label: "Bank", icon: "🏦" },
  { value: "investment", label: "Investment", icon: "📈" },
  { value: "legal", label: "Legal / Will", icon: "⚖️" },
  { value: "medical", label: "Medical", icon: "🩺" },
  { value: "other", label: "Other", icon: "📄" },
];

function catMeta(v: string) {
  return CATEGORIES.find((c) => c.value === v) ?? CATEGORIES[CATEGORIES.length - 1];
}

function fmtSize(bytes: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const EMPTY = { title: "", category: "other", note: "" };

export default function DocumentsPage() {
  const { success, error: toastError } = useToast();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [query, setQuery] = useState("");
  const [filterCat, setFilterCat] = useState<string>("all");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/documents").then((r) => r.json());
      setDocs(res.documents ?? []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  function openAdd() {
    setEditId(null);
    setForm({ ...EMPTY });
    setFile(null);
    setOpen(true);
  }
  function openEdit(d: Doc) {
    setEditId(d.id);
    setForm({ title: d.title, category: d.category, note: d.note ?? "" });
    setFile(null);
    setOpen(true);
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    // Prefill title from the filename if empty.
    if (f && !form.title.trim()) {
      setForm((prev) => ({ ...prev, title: f.name.replace(/\.[^.]+$/, "") }));
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editId) {
        const res = await fetch(`/api/documents/${editId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: form.title, category: form.category, note: form.note || null }),
        });
        if (!res.ok) return toastError("Couldn't update the document.");
        success("Document updated.");
      } else {
        if (!file) return toastError("Please choose a file to upload.");
        const base64 = await fileToBase64(file);
        const res = await fetch("/api/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: form.title,
            category: form.category,
            note: form.note || undefined,
            fileName: file.name,
            fileType: file.type || "application/octet-stream",
            fileData: base64,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return toastError(data.error ?? "Couldn't upload the document.");
        success("Document added.");
      }
      setOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(d: Doc) {
    if (!confirm(`Delete "${d.title}"? This permanently removes the file.`)) return;
    const res = await fetch(`/api/documents/${d.id}`, { method: "DELETE" });
    if (res.ok) {
      success("Document deleted.");
      load();
    } else toastError("Couldn't delete the document.");
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return docs.filter((d) => {
      if (filterCat !== "all" && d.category !== filterCat) return false;
      if (!q) return true;
      return (
        d.title.toLowerCase().includes(q) ||
        d.fileName.toLowerCase().includes(q) ||
        (d.note ?? "").toLowerCase().includes(q)
      );
    });
  }, [docs, query, filterCat]);

  const totalSize = docs.reduce((s, d) => s + d.fileSize, 0);

  return (
    <div className="flex flex-col gap-5 stagger">
      <PageHeader
        title="Documents"
        sub={`${docs.length} file${docs.length === 1 ? "" : "s"}`}
        action={<Button onClick={openAdd}>+ Add Document</Button>}
      />

      {docs.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Documents" value={String(docs.length)} tone="accent" icon="🗂" />
          <StatCard label="Storage used" value={fmtSize(totalSize)} tone="blue" icon="◆" />
        </div>
      )}

      {docs.length > 0 && (
        <div className="flex flex-col gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents…"
          />
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setFilterCat("all")}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                filterCat === "all"
                  ? "bg-accent-glow text-accent border-accent/40"
                  : "text-muted border-border-soft hover:bg-surface2"
              }`}
            >
              All
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                onClick={() => setFilterCat(c.value)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  filterCat === c.value
                    ? "bg-accent-glow text-accent border-accent/40"
                    : "text-muted border-border-soft hover:bg-surface2"
                }`}
              >
                {c.icon} {c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <Card>
        {loading ? (
          <div className="text-sm text-muted-soft py-4">Loading…</div>
        ) : docs.length === 0 ? (
          <EmptyState
            icon="🗂"
            title="No documents yet"
            sub="Keep your family's important papers here — tax returns, property deeds, insurance policies, IDs and more"
          />
        ) : filtered.length === 0 ? (
          <div className="text-sm text-muted-soft py-4">No documents match your search.</div>
        ) : (
          <div className="flex flex-col divide-y divide-border-soft">
            {filtered.map((d) => {
              const meta = catMeta(d.category);
              return (
                <div key={d.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0 gap-3">
                  <div className="min-w-0 flex items-start gap-3">
                    <span className="text-lg shrink-0">{meta.icon}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <a
                          href={`/api/documents/${d.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-sm text-accent hover:text-accent-soft truncate"
                        >
                          {d.title}
                        </a>
                        <Badge tone="blue">{meta.label}</Badge>
                      </div>
                      <div className="text-xs text-muted mt-0.5 truncate">
                        {d.fileName}
                        {d.fileSize ? ` · ${fmtSize(d.fileSize)}` : ""}
                      </div>
                      {d.note && <div className="text-xs text-muted-soft mt-0.5">{d.note}</div>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    <button onClick={() => openEdit(d)} className="text-xs text-accent hover:text-accent-soft">
                      Edit
                    </button>
                    <button onClick={() => remove(d)} className="text-xs text-muted-soft hover:text-red">
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <p className="text-xs text-muted-soft">
        Files are stored privately for your household (max ~8MB each). Only members of your household can view or
        download them.
      </p>

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? "Edit Document" : "Add Document"}>
        <form onSubmit={save} className="flex flex-col gap-3">
          {!editId && (
            <div>
              <label>File</label>
              <input type="file" onChange={onPick} className="!p-2" />
            </div>
          )}
          <div>
            <label>Title</label>
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. 2024 Tax Return"
            />
          </div>
          <div>
            <label>Category</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.icon} {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Note (optional)</label>
            <textarea
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              rows={2}
              placeholder="Any details worth remembering"
            />
          </div>
          <Button type="submit" disabled={saving} className="w-full">
            {saving ? "Saving…" : editId ? "Save changes" : "Upload document"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
