import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getPlan } from "@/lib/server/plans";
import { updatePlanAction } from "../../../../plan-actions";
import { PlanForm } from "./plan-form";

async function EditPlan({ params }: { params: PageProps<"/pacienti/[id]/plany/[planId]/upravit">["params"] }) {
  const { id, planId } = await params;
  const plan = await getPlan(id, planId);
  if (!plan) notFound();

  return (
    <>
      <h1 className="mb-5 text-2xl font-semibold">Upraviť plán</h1>
      <PlanForm
        action={updatePlanAction.bind(null, plan.patient_id, plan.id)}
        title={plan.title}
        content={plan.content}
        cancelHref={`/pacienti/${plan.patient_id}/plany/${plan.id}`}
      />
    </>
  );
}

export default function EditPlanPage({ params }: PageProps<"/pacienti/[id]/plany/[planId]/upravit">) {
  return (
    <div className="mx-auto max-w-4xl">
      <Suspense fallback={<p className="text-slate-500">Načítavam…</p>}>
        <EditPlan params={params} />
      </Suspense>
    </div>
  );
}
