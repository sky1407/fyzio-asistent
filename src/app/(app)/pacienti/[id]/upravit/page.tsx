import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getPatient } from "@/lib/server/patients";
import { updatePatientAction } from "../../actions";
import { PatientForm } from "../../patient-form";

async function EditForm({ params }: { params: PageProps<"/pacienti/[id]/upravit">["params"] }) {
  const { id } = await params;
  const patient = await getPatient(id);
  if (!patient) notFound();

  return (
    <>
      <h1 className="mb-5 text-2xl font-semibold">
        Upraviť: {patient.first_name} {patient.last_name}
      </h1>
      <PatientForm
        action={updatePatientAction.bind(null, patient.id)}
        patient={patient}
        submitLabel="Uložiť zmeny"
        cancelHref={`/pacienti/${patient.id}`}
      />
    </>
  );
}

export default function EditPatientPage({ params }: PageProps<"/pacienti/[id]/upravit">) {
  return (
    <div className="mx-auto max-w-3xl">
      <Suspense fallback={<p className="text-slate-500">Načítavam…</p>}>
        <EditForm params={params} />
      </Suspense>
    </div>
  );
}
