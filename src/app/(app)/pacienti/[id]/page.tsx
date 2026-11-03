import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ACTIVITY_LEVELS, SEXES, WORK_TYPES, ageFromBirthYear, bmi, bmiCategory } from "@/lib/patients/model";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { getPatient } from "@/lib/server/patients";
import { listPlans } from "@/lib/server/plans";
import { deletePatientAction } from "../actions";

function formatNumber(value: number | null, unit: string): string {
  return value === null ? "—" : `${value.toLocaleString("sk-SK")} ${unit}`;
}

function Stat({ label, value, note }: { label: string; value: string; note?: string | null }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
      {note && <p className="text-sm text-slate-600">{note}</p>}
    </div>
  );
}

function TextBlock({ title, text }: { title: string; text: string }) {
  return (
    <section className="card">
      <h2 className="mb-1.5 text-sm font-semibold uppercase tracking-wide text-teal-800">{title}</h2>
      {text ? (
        <p className="whitespace-pre-wrap text-slate-800">{text}</p>
      ) : (
        <p className="text-slate-400">Nevyplnené</p>
      )}
    </section>
  );
}

async function PatientDetail({ params }: { params: PageProps<"/pacienti/[id]">["params"] }) {
  const { id } = await params;
  const [patient, plans] = await Promise.all([getPatient(id), listPlans(id)]);
  if (!patient) notFound();

  const fullName = `${patient.first_name} ${patient.last_name}`;
  const age = ageFromBirthYear(patient.birth_year);
  const bodyMassIndex = bmi(patient.height_cm, patient.weight_kg);
  const work = [patient.occupation, patient.work_type ? WORK_TYPES[patient.work_type] : null].filter(Boolean).join(" — ");

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{fullName}</h1>
          <p className="text-slate-600">
            {[patient.sex ? SEXES[patient.sex] : null, patient.birth_year ? `nar. ${patient.birth_year}` : null]
              .filter(Boolean)
              .join(" · ") || "Bez osobných údajov"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/pacienti/${patient.id}/upravit`} className="btn-secondary">
            Upraviť
          </Link>
          <ConfirmDeleteButton
            action={deletePatientAction.bind(null, patient.id)}
            confirmMessage={`Naozaj vymazať pacienta ${fullName}? Vymažú sa aj všetky jeho plány a rozhovory s AI. Túto akciu nie je možné vrátiť.`}
          />
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Vek" value={age === null ? "—" : `${age} r.`} />
        <Stat label="Výška" value={formatNumber(patient.height_cm, "cm")} />
        <Stat label="Váha" value={formatNumber(patient.weight_kg, "kg")} />
        <Stat label="BMI" value={bodyMassIndex === null ? "—" : bodyMassIndex.toLocaleString("sk-SK")} note={bmiCategory(bodyMassIndex)} />
      </div>

      <section className="card mb-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-teal-800">Plány ({plans.length})</h2>
          <Link href={`/?pacient=${patient.id}`} className="btn-primary px-3 py-1.5 text-sm">
            Vytvoriť plán s AI
          </Link>
        </div>
        {plans.length === 0 ? (
          <p className="text-slate-500">
            Zatiaľ žiadne plány. Vytvorte ich v AI asistentovi tlačidlom „Uložiť ako plán“ pod odpoveďou.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {plans.map((plan) => (
              <li key={plan.id}>
                <Link
                  href={`/pacienti/${patient.id}/plany/${plan.id}`}
                  className="flex flex-wrap items-baseline justify-between gap-x-3 py-2.5 hover:text-teal-800"
                >
                  <span className="font-medium">{plan.title}</span>
                  <span className="text-sm text-slate-500">{plan.updated_label}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <TextBlock title="Práca" text={work} />
        <TextBlock
          title="Pohybová aktivita"
          text={patient.activity_level ? ACTIVITY_LEVELS[patient.activity_level] : ""}
        />
        <TextBlock title="Diagnózy" text={patient.diagnoses} />
        <TextBlock title="Obmedzenia a kontraindikácie" text={patient.limitations} />
        <TextBlock title="Ciele" text={patient.goals} />
        <TextBlock title="Poznámky" text={patient.notes} />
      </div>
    </>
  );
}

export default function PatientPage({ params }: PageProps<"/pacienti/[id]">) {
  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/" className="mb-4 inline-block text-sm font-medium text-teal-700 hover:underline">
        ← Späť na pacientov
      </Link>
      <Suspense fallback={<p className="text-slate-500">Načítavam pacienta…</p>}>
        <PatientDetail params={params} />
      </Suspense>
    </div>
  );
}
