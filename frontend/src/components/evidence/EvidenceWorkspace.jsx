"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, ChevronDown, CloudUpload, FileArchive, FileJson2, FileText, Filter, Hash, LoaderCircle, Search, ShieldAlert, X } from "lucide-react";
import { listClaims } from "@/services/claimService";
import { getEvidence, listEvidence, uploadEvidence } from "@/services/evidenceService";

const MAX_FILES = 10;
const MAX_BYTES = 10 * 1024 * 1024;
const allowedExtensions = new Set([".zip", ".json", ".csv", ".md", ".markdown"]);
const allowedMimeTypes = {
  ".json": new Set(["application/json", "text/json", "application/octet-stream"]),
  ".csv": new Set(["text/csv", "application/csv", "text/plain", "application/octet-stream"]),
  ".md": new Set(["text/markdown", "text/plain", "application/octet-stream"]),
  ".markdown": new Set(["text/markdown", "text/plain", "application/octet-stream"]),
  ".zip": new Set(["application/zip", "application/x-zip-compressed", "application/octet-stream"])
};
const sourceFilters = ["all", "git_commit", "pull_request", "chat_message", "task", "markdown_document", "csv_record", "manual_entry"];
const sourceLabels = { git_commit: "Git commit", pull_request: "Pull request", chat_message: "Chat message", task: "Task", markdown_document: "Markdown", csv_record: "CSV record", manual_entry: "Manual entry" };

function extensionOf(name) { return name.toLowerCase().slice(name.lastIndexOf(".")); }
function formatSize(bytes) { return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
function formatDate(value) {
  if (!value || Number.isNaN(new Date(value).getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function EvidenceWorkspace({ caseId }) {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState("upload");
  const [files, setFiles] = useState([]);
  const [fileErrors, setFileErrors] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [summary, setSummary] = useState(null);
  const [records, setRecords] = useState([]);
  const [claims, setClaims] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(50);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [sourceType, setSourceType] = useState("all");
  const [author, setAuthor] = useState("all");
  const [accessLevel, setAccessLevel] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selected, setSelected] = useState(null);
  const [detailError, setDetailError] = useState("");
  const [loadingDetail, setLoadingDetail] = useState(false);
  const inputRef = useRef(null);

  const loadRecords = useCallback(async (signal) => {
    setLoadingRecords(true);
    setLoadError("");
    try {
      const [evidenceResult, claimsResult] = await Promise.all([
        listEvidence(caseId, { signal }),
        listClaims(caseId, { signal }).catch(() => [])
      ]);
      setRecords(Array.isArray(evidenceResult) ? evidenceResult : []);
      setClaims(Array.isArray(claimsResult) ? claimsResult : []);
    } catch (error) {
      if (error.name !== "AbortError") setLoadError(error.message || "Could not load evidence.");
    } finally {
      if (!signal?.aborted) setLoadingRecords(false);
    }
  }, [caseId]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve().then(() => loadRecords(controller.signal));
    return () => controller.abort();
  }, [loadRecords]);

  useEffect(() => {
    const evidenceId = searchParams.get("evidence");
    if (!evidenceId) return;
    const controller = new AbortController();
    Promise.resolve().then(() => {
      setTab("explore");
      setLoadingDetail(true);
      setDetailError("");
      return getEvidence(evidenceId, { signal: controller.signal });
    }).then(setSelected).catch((error) => { if (error.name !== "AbortError") setDetailError(error.message); }).finally(() => { if (!controller.signal.aborted) setLoadingDetail(false); });
    return () => controller.abort();
  }, [searchParams]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return records.filter((record) => {
      if (sourceType !== "all" && record.sourceType !== sourceType) return false;
      if (author !== "all" && (record.author || "Unknown author") !== author) return false;
      if (accessLevel !== "all" && record.accessLevel !== accessLevel) return false;
      const timestamp = record.timestamp ? new Date(record.timestamp).getTime() : null;
      if (fromDate && (timestamp === null || timestamp < new Date(`${fromDate}T00:00:00`).getTime())) return false;
      if (toDate && (timestamp === null || timestamp > new Date(`${toDate}T23:59:59.999`).getTime())) return false;
      return !term || [record.text, record.sourceName, record.locator, record.author].some((value) => String(value || "").toLowerCase().includes(term));
    });
  }, [accessLevel, author, fromDate, query, records, sourceType, toDate]);

  const authors = useMemo(() => [...new Set(records.map((record) => record.author || "Unknown author"))].sort(), [records]);

  function addFiles(fileList) {
    const incoming = Array.from(fileList || []);
    const nextErrors = [];
    const accepted = [];
    const available = Math.max(0, MAX_FILES - files.length);
    if (incoming.length > available) nextErrors.push(`The API accepts up to ${MAX_FILES} files per upload. Remove ${incoming.length - available} file(s) or upload in another batch.`);
    for (const file of incoming.slice(0, available)) {
      const ext = extensionOf(file.name);
      if (!allowedExtensions.has(ext)) nextErrors.push(`${file.name}: unsupported extension. Choose ZIP, JSON, CSV or Markdown.`);
      else if (file.type && !allowedMimeTypes[ext]?.has(file.type.toLowerCase())) nextErrors.push(`${file.name}: file type does not match the supported MIME types for ${ext}.`);
      else if (file.size > MAX_BYTES) nextErrors.push(`${file.name}: exceeds the 10 MB per-file limit.`);
      else if (file.size === 0) nextErrors.push(`${file.name}: file is empty.`);
      else accepted.push(file);
    }
    setFiles((current) => [...current, ...accepted]);
    setFileErrors(nextErrors);
  }

  async function submitUpload() {
    if (!files.length || uploading) return;
    setUploading(true);
    setUploadError("");
    setSummary(null);
    try {
      const result = await uploadEvidence(caseId, files);
      setSummary(result);
      setFiles([]);
      await loadRecords();
    } catch (error) {
      setUploadError(error.message || "Upload could not be processed.");
    } finally {
      setUploading(false);
    }
  }

  async function selectEvidence(record) {
    setSelected(record);
    setDetailError("");
    setLoadingDetail(true);
    try {
      setSelected(await getEvidence(record._id));
    } catch (error) {
      setDetailError(error.message || "Could not load evidence details.");
    } finally {
      setLoadingDetail(false);
    }
  }

  const selectedQuotes = selected ? claims.flatMap((claim) => (claim.citations || []).filter((citation) => String(citation.evidenceId) === String(selected._id)).map((citation) => ({ claim, quote: citation.quote }))) : [];

  return (
    <div className="mx-auto w-full max-w-[1440px] px-5 pb-10 pt-7 sm:px-8 sm:pt-9 xl:px-10">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><Link href={`/cases/${caseId}`} className="text-[10px] text-zinc-600 hover:text-zinc-300">Case overview</Link><h1 className="mt-3 text-[25px] font-semibold tracking-[-0.045em] text-zinc-100">Evidence</h1><p className="mt-1.5 text-[11px] text-zinc-500">Upload source records, then inspect the normalized evidence saved for this case.</p></div><div className="flex rounded-lg border border-white/[0.07] bg-white/[0.02] p-1"><button type="button" onClick={() => setTab("upload")} className={`rounded-md px-3 py-1.5 text-[10px] ${tab === "upload" ? "bg-white/[0.08] text-zinc-200" : "text-zinc-600"}`}>Upload</button><button type="button" onClick={() => setTab("explore")} className={`rounded-md px-3 py-1.5 text-[10px] ${tab === "explore" ? "bg-white/[0.08] text-zinc-200" : "text-zinc-600"}`}>Explore <span className="ml-1 text-zinc-500">{records.length}</span></button></div></div>

      {tab === "upload" ? <div className="mt-6 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-xl border border-white/[0.065] bg-[#111114] p-5 sm:p-6">
          <div className="mb-4"><h2 className="text-[13px] font-semibold text-zinc-200">Add project records</h2><p className="mt-1 text-[10px] text-zinc-600">The server validates file signatures, types, sizes, archive contents and paths before processing.</p></div>
          <div role="button" tabIndex={0} onClick={() => inputRef.current?.click()} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); inputRef.current?.click(); } }} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); }} className={`flex min-h-[190px] w-full cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-5 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300 ${dragging ? "border-violet-300/50 bg-violet-300/[0.06]" : "border-white/[0.12] bg-black/10 hover:border-white/[0.2] hover:bg-white/[0.015]"}`}><span className="flex h-11 w-11 items-center justify-center rounded-xl border border-violet-300/10 bg-violet-300/[0.05] text-violet-200"><CloudUpload size={20} /></span><span className="mt-3 text-[12px] font-medium text-zinc-200">Drop files here or <span className="text-violet-200">browse</span></span><span className="mt-1.5 text-[10px] text-zinc-600">ZIP, JSON, CSV, MD · Up to 10 files · 10 MB each</span></div><input ref={inputRef} type="file" multiple accept=".zip,.json,.csv,.md,.markdown" className="sr-only" onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }} />
          {fileErrors.length > 0 && <ul className="mt-3 space-y-1 rounded-lg border border-amber-300/10 bg-amber-300/[0.025] px-3 py-2.5">{fileErrors.map((error) => <li key={error} className="flex gap-2 text-[10px] leading-4 text-amber-100/75"><AlertCircle className="mt-0.5 shrink-0" size={12} />{error}</li>)}</ul>}
          {files.length > 0 && <div className="mt-4 divide-y divide-white/[0.05] rounded-lg border border-white/[0.06]">{files.map((file, index) => <div key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center gap-3 px-3 py-2.5"><FileIcon filename={file.name} /><span className="min-w-0 flex-1"><span className="block truncate text-[10px] font-medium text-zinc-300">{file.name}</span><span className="mt-0.5 block text-[9px] text-zinc-600">{formatSize(file.size)} · {extensionOf(file.name).slice(1).toUpperCase()}</span></span><button type="button" onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))} aria-label={`Remove ${file.name}`} className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-600 hover:bg-white/[0.05] hover:text-zinc-300"><X size={14} /></button></div>)}</div>}
          {uploadError && <p role="alert" className="mt-3 rounded-lg border border-rose-300/10 bg-rose-300/[0.04] px-3 py-2.5 text-[10px] text-rose-200">{uploadError}</p>}
          {summary && <UploadSummary summary={summary} />}
          <div className="mt-4 flex flex-col gap-3 border-t border-white/[0.05] pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-[9px] leading-4 text-zinc-600">Access defaults to Team. JSON/CSV records may specify accessLevel per record; this upload endpoint does not accept a global access setting.</p><button type="button" aria-live="polite" disabled={!files.length || uploading} onClick={submitUpload} className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-violet-300 px-3.5 text-[10px] font-semibold text-[#100d1d] hover:bg-violet-200 disabled:cursor-not-allowed disabled:opacity-45">{uploading ? <><LoaderCircle size={13} className="animate-spin" /> Uploading and processing…</> : <>Upload {files.length || "files"}</>}</button></div>
        </section>
        <aside className="rounded-xl border border-white/[0.065] bg-[#111114] p-5"><h2 className="text-[12px] font-semibold text-zinc-200">Supported sources</h2><div className="mt-4 space-y-3"><FormatRow icon={FileArchive} title="Repository ZIP" detail="Must include a local .git directory for history." /><FormatRow icon={FileJson2} title="JSON exports" detail="Chat, PR, task and normalized records." /><FormatRow icon={FileText} title="CSV and Markdown" detail="Task exports, notes and project docs." /></div><div className="mt-5 rounded-lg border border-amber-300/[0.09] bg-amber-300/[0.025] p-3"><p className="text-[10px] font-medium text-amber-100/80">Handling sensitive evidence</p><p className="mt-1 text-[9px] leading-4 text-zinc-600">The backend redacts recognized secrets and separates restricted originals. Review each record’s access level before sharing a handover.</p></div></aside>
      </div> : <div className="mt-6 rounded-xl border border-white/[0.065] bg-[#111114]">
        <div className="flex flex-col gap-3 border-b border-white/[0.055] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"><div><h2 className="text-[13px] font-semibold text-zinc-200">Evidence explorer</h2><p className="mt-1 text-[10px] text-zinc-600">{loadingRecords ? "Loading records…" : `${filtered.length} of ${records.length} accessible records`}</p></div><div className="flex flex-col gap-2 sm:flex-row"><label className="flex h-9 items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 text-zinc-600 sm:w-[250px]"><Search size={13} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search text, source, author" aria-label="Search evidence" className="min-w-0 flex-1 bg-transparent text-[10px] text-zinc-200 outline-none placeholder:text-zinc-700" /></label><label className="flex h-9 items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 text-zinc-500"><Filter size={12} /><select value={sourceType} onChange={(event) => setSourceType(event.target.value)} aria-label="Filter by source type" className="bg-transparent text-[10px] text-zinc-300 outline-none">{sourceFilters.map((type) => <option key={type} value={type} className="bg-[#111114]">{type === "all" ? "All sources" : sourceLabels[type]}</option>)}</select><ChevronDown size={12} /></label></div><div className="grid gap-2 border-b border-white/[0.045] bg-black/[0.06] px-4 py-3 sm:grid-cols-2 lg:grid-cols-4"><label className="flex h-8 min-w-0 items-center gap-2 rounded-md border border-white/[0.06] px-2 text-[8px] text-zinc-600"><span>Author</span><select aria-label="Filter by author" value={author} onChange={(event) => setAuthor(event.target.value)} className="min-w-0 flex-1 truncate bg-transparent text-zinc-400 outline-none"><option value="all" className="bg-[#111114]">All authors</option>{authors.map((name) => <option key={name} value={name} className="bg-[#111114]">{name}</option>)}</select></label><label className="flex h-8 items-center gap-2 rounded-md border border-white/[0.06] px-2 text-[8px] text-zinc-600"><span>Access</span><select aria-label="Filter by access level" value={accessLevel} onChange={(event) => setAccessLevel(event.target.value)} className="flex-1 bg-transparent text-zinc-400 outline-none"><option value="all" className="bg-[#111114]">All levels</option><option value="team" className="bg-[#111114]">Team</option><option value="leads_only" className="bg-[#111114]">Leads only</option><option value="restricted" className="bg-[#111114]">Restricted</option></select></label><label className="flex h-8 items-center gap-2 rounded-md border border-white/[0.06] px-2 text-[8px] text-zinc-600"><span>From</span><input aria-label="Evidence from date" type="date" value={fromDate} max={toDate || undefined} onChange={(event) => setFromDate(event.target.value)} className="min-w-0 flex-1 bg-transparent text-[8px] text-zinc-400 outline-none" /></label><label className="flex h-8 items-center gap-2 rounded-md border border-white/[0.06] px-2 text-[8px] text-zinc-600"><span>To</span><input aria-label="Evidence to date" type="date" value={toDate} min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} className="min-w-0 flex-1 bg-transparent text-[8px] text-zinc-400 outline-none" /></label></div></div>
        {loadError ? <div className="p-8 text-center"><p className="text-[11px] text-rose-200">{loadError}</p><button type="button" onClick={() => loadRecords()} className="mt-3 text-[10px] text-zinc-400 hover:text-white">Retry</button></div> : loadingRecords ? <div className="space-y-2 p-5">{[0, 1, 2, 3].map((item) => <div key={item} className="h-16 animate-pulse rounded-lg bg-white/[0.03]" />)}</div> : records.length === 0 ? <div className="px-6 py-16 text-center"><FileSearchIcon /><h3 className="mt-3 text-[12px] font-medium text-zinc-300">No evidence uploaded</h3><p className="mx-auto mt-1 max-w-sm text-[10px] leading-5 text-zinc-600">Upload repository history, documentation or project exports to begin collecting source records.</p><button type="button" onClick={() => setTab("upload")} className="mt-4 text-[10px] text-violet-200">Upload evidence</button></div> : filtered.length === 0 ? <p className="px-6 py-14 text-center text-[10px] text-zinc-600">No records match those filters.</p> : <div className="grid min-h-[440px] lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"><div className="max-h-[700px] overflow-y-auto divide-y divide-white/[0.04]">{filtered.slice(0, visibleLimit).map((record) => <button type="button" key={record._id} onClick={() => selectEvidence(record)} className={`block w-full px-4 py-3.5 text-left transition-colors hover:bg-white/[0.025] ${selected?._id === record._id ? "bg-violet-300/[0.04]" : ""}`}><div className="flex items-center justify-between gap-2"><span className="rounded border border-white/[0.06] px-1.5 py-1 text-[8px] font-medium uppercase tracking-wider text-zinc-500">{sourceLabels[record.sourceType] || record.sourceType}</span><span className="text-[9px] text-zinc-700">{formatDate(record.timestamp)}</span></div><p className="mt-2 line-clamp-2 text-[10px] leading-4 text-zinc-300">{record.text}</p><div className="mt-2 flex min-w-0 items-center justify-between gap-2 text-[9px] text-zinc-600"><span className="truncate">{record.author || "Unknown author"} · {record.sourceName}</span><span className="shrink-0">{record.accessLevel?.replace("_", " ")}</span></div></button>)}</div>{filtered.length > visibleLimit && <div className="border-t border-white/[0.05] p-3 text-center"><button type="button" onClick={() => setVisibleLimit((limit) => Math.min(limit + 50, 250))} className="text-[9px] text-violet-200 hover:text-violet-100">Show more records · {visibleLimit} of {filtered.length}</button>{visibleLimit >= 250 && <p className="mt-2 text-[8px] text-zinc-700">For performance, up to 250 records are shown per filter view.</p>}</div>}<EvidenceDetail record={selected} quotes={selectedQuotes} loading={loadingDetail} error={detailError} /></div>}
      </div>}
    </div>
  );
}

function FileIcon({ filename }) { const ext = extensionOf(filename); const Icon = ext === ".zip" ? FileArchive : ext === ".json" ? FileJson2 : FileText; return <Icon size={16} className="shrink-0 text-zinc-500" />; }
function FileSearchIcon() { return <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.02] text-zinc-500"><Search size={17} /></span>; }
function FormatRow({ icon: Icon, title, detail }) { return <div className="flex gap-3"><div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/[0.035] text-zinc-500"><Icon size={14} /></div><div><p className="text-[10px] font-medium text-zinc-300">{title}</p><p className="mt-1 text-[9px] leading-4 text-zinc-600">{detail}</p></div></div>; }

function UploadSummary({ summary }) {
  const stats = [["Files uploaded", summary.totalFilesUploaded], ["Records extracted", summary.recordsExtracted], ["Records saved", summary.recordsSaved], ["Duplicates skipped", summary.duplicateRecordsSkipped]];
  const errors = [...(summary.failedFiles || []).map((file) => ({ ...file, type: "Failed" })), ...(summary.unsupportedFiles || []).map((file) => ({ ...file, type: "Unsupported" }))];
  return <div className="mt-4 rounded-lg border border-white/[0.07] bg-black/10 p-4"><div className="flex items-center gap-2"><CheckCircle2 size={14} className={errors.length ? "text-amber-200" : "text-emerald-200"} /><h3 className="text-[11px] font-medium text-zinc-200">{errors.length ? "Upload completed with file issues" : "Upload processing complete"}</h3></div><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{stats.map(([label, value]) => <div key={label} className="rounded-md bg-white/[0.025] px-2.5 py-2"><p className="text-[8px] text-zinc-600">{label}</p><p className="mt-1 text-[13px] font-semibold tabular-nums text-zinc-200">{value ?? 0}</p></div>)}</div>{errors.length > 0 && <ul className="mt-3 space-y-2">{errors.map((file, index) => <li key={`${file.filename}-${index}`} className="flex gap-2 text-[9px] leading-4 text-amber-100/70"><AlertCircle className="mt-0.5 shrink-0" size={12} /><span><strong className="font-medium">{file.type}: {file.filename}</strong> — {file.reason}</span></li>)}</ul>}</div>;
}

function EvidenceDetail({ record, quotes, loading, error }) {
  if (!record) return <div className="flex min-h-[400px] items-center justify-center border-t border-white/[0.05] px-6 text-center lg:border-l lg:border-t-0"><div><Hash size={20} className="mx-auto text-zinc-700" /><p className="mt-3 text-[10px] text-zinc-600">Select an evidence record to inspect its source details.</p></div></div>;
  return <aside className="subtle-scrollbar max-h-[700px] overflow-y-auto border-t border-white/[0.05] p-5 lg:border-l lg:border-t-0"><div className="flex items-start justify-between gap-4"><div><span className="text-[8px] font-medium uppercase tracking-[0.12em] text-violet-200/70">Source record</span><h3 className="mt-1 break-all text-[12px] font-semibold text-zinc-200">{record.sourceName}</h3></div><span className="rounded border border-white/[0.07] px-1.5 py-1 text-[8px] uppercase tracking-wider text-zinc-500">{sourceLabels[record.sourceType] || record.sourceType}</span></div>{loading && <p className="mt-3 text-[9px] text-zinc-600">Loading full record…</p>}{error && <p role="alert" className="mt-3 text-[9px] text-rose-200">{error}</p>}<div className="mt-4 grid grid-cols-2 gap-3 rounded-lg border border-white/[0.06] bg-black/10 p-3"><Meta label="Author" value={record.author || "Unknown"} /><Meta label="Timestamp" value={formatDate(record.timestamp)} /><Meta label="Locator" value={record.locator} /><Meta label="Access" value={record.accessLevel?.replace("_", " ")} /></div><div className="mt-4"><h4 className="text-[9px] font-semibold uppercase tracking-[0.1em] text-zinc-600">Evidence text</h4><p className="mt-2 whitespace-pre-wrap break-words rounded-lg border border-white/[0.05] bg-black/10 p-3 text-[10px] leading-5 text-zinc-300"><HighlightedEvidence text={record.text} quotes={quotes.map((item) => item.quote)} /></p></div>{record.redactionApplied && <p className="mt-3 flex items-center gap-2 text-[9px] text-amber-100/65"><ShieldAlert size={12} />Sensitive patterns were redacted by the backend.</p>}{record.hash && <div className="mt-4"><Meta label="SHA-256 hash" value={record.hash} /></div>}{record.metadata && Object.keys(record.metadata).length > 0 && <details className="mt-4 rounded-lg border border-white/[0.05] px-3 py-2"><summary className="cursor-pointer text-[9px] text-zinc-500">Source metadata</summary><pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all text-[9px] leading-4 text-zinc-600">{JSON.stringify(record.metadata, null, 2)}</pre></details>}{quotes.length > 0 && <div className="mt-5"><h4 className="text-[9px] font-semibold uppercase tracking-[0.1em] text-zinc-600">Claims citing this record</h4><div className="mt-2 space-y-2">{quotes.map(({ claim, quote }, index) => <Link key={`${claim._id}-${index}`} href={`/cases/${claim.caseId}/claims?claim=${claim._id}`} className="block rounded-lg border border-violet-300/[0.09] bg-violet-300/[0.025] p-3 hover:bg-violet-300/[0.045]"><p className="text-[9px] leading-4 text-violet-100/75">“{quote}”</p><p className="mt-2 line-clamp-2 text-[9px] text-zinc-500">{claim.text}</p></Link>)}</div></div>}</aside>;
}
function Meta({ label, value }) { return <div className="min-w-0"><p className="text-[8px] uppercase tracking-wider text-zinc-700">{label}</p><p className="mt-1 break-all text-[9px] leading-4 text-zinc-400">{value || "—"}</p></div>; }

function HighlightedEvidence({ text, quotes }) {
  if (!quotes?.length) return text;
  const ranges = [];
  const lowerText = String(text || "").toLowerCase();
  for (const quote of quotes) {
    const index = lowerText.indexOf(String(quote || "").toLowerCase());
    if (index >= 0 && !ranges.some(([start, end]) => index < end && index + quote.length > start)) ranges.push([index, index + quote.length]);
  }
  if (!ranges.length) return text;
  ranges.sort((a, b) => a[0] - b[0]);
  const parts = [];
  let cursor = 0;
  for (const [start, end] of ranges) {
    parts.push(text.slice(cursor, start));
    parts.push(<mark key={`${start}-${end}`} className="rounded-sm bg-emerald-300/20 text-emerald-100">{text.slice(start, end)}</mark>);
    cursor = end;
  }
  parts.push(text.slice(cursor));
  return parts;
}
