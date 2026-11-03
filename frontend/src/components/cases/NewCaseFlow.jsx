"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CircleHelp, FolderKanban, Users } from "lucide-react";
import { createCase } from "@/services/caseService";

const fieldBase = "mt-1.5 h-10 w-full rounded-lg border border-white/[0.09] bg-[#0c0c0f] px-3 text-[12px] text-zinc-200 outline-none transition focus:border-violet-300/35 focus:ring-2 focus:ring-violet-300/[0.08]";
const steps = [{ label: "Project", icon: FolderKanban }, { label: "People", icon: Users }, { label: "Confirm", icon: Check }];

export default function NewCaseFlow() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [values, setValues] = useState({ projectName: "", title: "", description: "", departingMember: "", successor: "" });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
  }

  function validateStep() {
    const nextErrors = {};
    const fields = step === 0 ? ["projectName", "title"] : step === 1 ? ["departingMember", "successor"] : [];
    for (const field of fields) {
      const value = values[field].trim();
      if (!value) nextErrors[field] = "This field is required.";
      else if (value.length > 200) nextErrors[field] = "Must be 200 characters or fewer.";
    }
    if (step === 0 && values.description.length > 5000) nextErrors.description = "Must be 5,000 characters or fewer.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function submitCase() {
    setSubmitError("");
    setSubmitting(true);
    try {
      const created = await createCase({ ...values, projectName: values.projectName.trim(), title: values.title.trim(), description: values.description.trim(), departingMember: values.departingMember.trim(), successor: values.successor.trim() });
      const id = created?._id || created?.id;
      if (!id) throw new Error("The API created the case but did not return its ID.");
      router.push(`/cases/${id}`);
    } catch (requestError) {
      setSubmitError(requestError.message || "The case could not be created. Please try again.");
      setSubmitting(false);
    }
  }

  function submitStep(event) {
    event.preventDefault();
    if (step < 2) {
      if (validateStep()) setStep((value) => value + 1);
    } else {
      submitCase();
    }
  }

  const inputField = (name, label, options = {}) => <div key={name} className={options.className || ""}><label htmlFor={name} className="text-[11px] font-medium text-zinc-300">{label}{options.required && <span className="ml-1 text-violet-300">*</span>}</label>{options.multiline ? <textarea id={name} rows={4} maxLength={5000} value={values[name]} onChange={(event) => update(name, event.target.value)} className={`${fieldBase} h-auto resize-y py-2.5`} placeholder={options.placeholder} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `${name}-error` : undefined} /> : <input id={name} maxLength={200} value={values[name]} onChange={(event) => update(name, event.target.value)} className={fieldBase} placeholder={options.placeholder} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `${name}-error` : undefined} />}{errors[name] && <p id={`${name}-error`} className="mt-1 text-[10px] text-rose-300">{errors[name]}</p>}</div>;

  return (
    <div className="mx-auto w-full max-w-[900px] px-5 pb-10 pt-7 sm:px-8 sm:pt-9">
      <Link href="/cases" className="inline-flex items-center gap-2 text-[10px] text-zinc-500 transition-colors hover:text-zinc-200"><ArrowLeft size={13} /> All cases</Link>
      <div className="mt-5"><p className="mb-2 text-[10px] font-medium uppercase tracking-[0.13em] text-violet-200/65">New handover</p><h1 className="text-[26px] font-semibold tracking-[-0.045em] text-zinc-100">Create a case</h1><p className="mt-2 text-[12px] text-zinc-500">Set up a focused workspace for knowledge transfer.</p></div>

      <div className="mt-7 grid grid-cols-3 gap-2" role="list" aria-label="Case creation steps">{steps.map((item, index) => { const Icon = item.icon; const active = index === step; const complete = index < step; return <div key={item.label} role="listitem" aria-current={active ? "step" : undefined} className={`flex items-center gap-2 border-t-2 pt-3 ${active ? "border-violet-300 text-zinc-200" : complete ? "border-emerald-300/50 text-zinc-400" : "border-white/[0.08] text-zinc-600"}`}><span className={`flex h-6 w-6 items-center justify-center rounded-md ${active ? "bg-violet-300/10 text-violet-200" : complete ? "bg-emerald-300/[0.08] text-emerald-200" : "bg-white/[0.035]"}`}>{complete ? <Check size={13} /> : <Icon size={13} />}</span><span className="text-[10px] font-medium">{item.label}</span></div>; })}</div>

      <form onSubmit={submitStep} noValidate className="mt-5 rounded-xl border border-white/[0.065] bg-[#111114] p-5 sm:p-7">
        {step === 0 && <div><h2 className="text-[14px] font-semibold text-zinc-200">Project information</h2><p className="mt-1 text-[11px] text-zinc-600">Name the project and this handover workspace.</p><div className="mt-6 grid gap-5">{inputField("projectName", "Project name", { required: true, placeholder: "e.g. Payments Platform" })}{inputField("title", "Case title", { required: true, placeholder: "e.g. Payments team transition" })}{inputField("description", "Description", { multiline: true, placeholder: "What should the successor know about this transition?" })}</div></div>}
        {step === 1 && <div><h2 className="text-[14px] font-semibold text-zinc-200">People involved</h2><p className="mt-1 text-[11px] text-zinc-600">Identify who is leaving and who will receive the handover.</p><div className="mt-6 grid gap-5 sm:grid-cols-2">{inputField("departingMember", "Departing member", { required: true, placeholder: "Name or team handle" })}{inputField("successor", "Successor", { required: true, placeholder: "Name or team handle" })}</div><div className="mt-5 flex gap-3 rounded-lg border border-sky-300/[0.09] bg-sky-300/[0.025] p-3 text-[10px] leading-5 text-zinc-500"><CircleHelp className="mt-0.5 shrink-0 text-sky-200/70" size={14} /><p>Reviewer assignment is not available in the current case creation API. You can create this case now; reviewer assignment needs backend support.</p></div></div>}
        {step === 2 && <div><h2 className="text-[14px] font-semibold text-zinc-200">Review case details</h2><p className="mt-1 text-[11px] text-zinc-600">Confirm the information before creating this workspace.</p><dl className="mt-6 divide-y divide-white/[0.05] rounded-lg border border-white/[0.06] bg-black/10">{[["Project", values.projectName], ["Case title", values.title], ["Description", values.description || "No description"], ["Departing member", values.departingMember], ["Successor", values.successor]].map(([label, value]) => <div key={label} className="grid gap-1 px-4 py-3 sm:grid-cols-[150px_1fr] sm:gap-4"><dt className="text-[10px] text-zinc-600">{label}</dt><dd className="break-words text-[11px] text-zinc-300">{value}</dd></div>)}</dl>{submitError && <p role="alert" className="mt-4 rounded-lg border border-rose-300/10 bg-rose-300/[0.04] px-3 py-2.5 text-[11px] text-rose-200">{submitError}</p>}</div>}
        <div className="mt-7 flex flex-col-reverse justify-between gap-3 border-t border-white/[0.055] pt-5 sm:flex-row">{step === 0 ? <span /> : <button type="button" onClick={() => { setStep((value) => value - 1); setSubmitError(""); }} disabled={submitting} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-white/[0.08] px-3 text-[11px] text-zinc-300 hover:bg-white/[0.04] disabled:opacity-50"><ArrowLeft size={13} /> Back</button>}{step < 2 ? <button type="submit" className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-violet-300 px-3.5 text-[11px] font-semibold text-[#100d1d] transition-colors hover:bg-violet-200">Continue <ArrowRight size={13} /></button> : <button type="submit" disabled={submitting} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-violet-300 px-3.5 text-[11px] font-semibold text-[#100d1d] transition-colors hover:bg-violet-200 disabled:cursor-wait disabled:opacity-60">{submitting ? "Creating case…" : "Create case"}<ArrowRight size={13} /></button>}</div>
      </form>
    </div>
  );
}
