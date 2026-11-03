import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { Markdown } from "@/components/markdown";
import { PrintButton } from "@/components/print-button";
import { getPatient } from "@/lib/server/patients";
import { getPlan } from "@/lib/server/plans";
import { deletePlanAction } from "../../../plan-actions";
import { ExtractExercises } from "./extract-exercises";

async function PlanDetail({ params }: { params: PageProps<"/pacienti/[id]/plany/[planId]">["params"] }) {
  const { id, planId } = await params;
  const [patient, plan] = await Promise.all([getPatient(id), getPlan(id, planId)]);
  if (!patient || !plan) notFound();

  const fullName = `${patient.first_name} ${patient.last_name}`;

  return (
    <>
      <Link href={`/pacienti/${patient.id}`} className="mb-4 inline-block text-sm font-medium text-teal-700 hover:underline print:hidden">
        ← Späť na pacienta {fullName}
      </Link>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{plan.title}</h1>
          <p className="text-slate-600">
            Pacient: {fullName} · upravené {plan.updated_label}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <PrintButton />
          <Link href={`/pacienti/${patient.id}/plany/${plan.id}/upravit`} className="btn-secondary">
            Upraviť
          </Link>
          <ConfirmDeleteButton
            action={deletePlanAction.bind(null, patient.id, plan.id)}
            confirmMessage={`Naozaj vymazať plán „${plan.title}“? Túto akciu nie je možné vrátiť.`}
          />
        </div>
      </div>
      <article className="card print:p-0 print:shadow-none print:ring-0">
        <Markdown text={plan.content} />
      </article>
      <ExtractExercises patientId={patient.id} planId={plan.id} />
    </>
  );
}

export default function PlanPage({ params }: PageProps<"/pacienti/[id]/plany/[planId]">) {
  return (
    <div className="mx-auto max-w-4xl">
      <Suspense fallback={<p className="text-slate-500">Načítavam plán…</p>}>
        <PlanDetail params={params} />
      </Suspense>
    </div>
  );
}
