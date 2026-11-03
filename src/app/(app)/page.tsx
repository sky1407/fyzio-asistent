import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import * as z from "zod";
import { WORK_TYPES, ageFromBirthYear, bmi, type Patient } from "@/lib/patients/model";
import { listPatients } from "@/lib/server/patients";
import { AssistantPanel } from "./_asistent/assistant-panel";
import { HomeTabs } from "./home-tabs";

function PatientList({ patients, search }: { patients: Patient[]; search: string }) {
  const aiHref = (id: string) => `/?${new URLSearchParams({ ...(search ? { q: search } : {}), pacient: id })}`;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Pacienti</h1>
        <Link href="/pacienti/novy" className="btn-primary">
          + Nový pacient
        </Link>
      </div>

      <Form action="/" className="mb-4 flex gap-2" role="search">
        <input
          key={search}
          name="q"
          type="search"
          defaultValue={search}
          placeholder="Hľadať meno, prácu alebo diagnózu…"
          aria-label="Hľadať pacienta"
          className="field-input"
        />
        <button type="submit" className="btn-secondary shrink-0">
          Hľadať
        </button>
      </Form>

      {patients.length === 0 ? (
        <div className="card text-center text-slate-600">
          {search ? (
            <p>
              Pre „{search}“ sa nenašiel žiadny pacient.{" "}
              <Link href="/" className="font-medium text-teal-700 underline">
                Zobraziť všetkých
              </Link>
            </p>
          ) : (
            <p>Zatiaľ tu nie sú žiadni pacienti. Začnite tlačidlom „Nový pacient“.</p>
          )}
        </div>
      ) : (
        <ul className="grid gap-3">
          {patients.map((patient) => {
            const age = ageFromBirthYear(patient.birth_year);
            const bodyMassIndex = bmi(patient.height_cm, patient.weight_kg);
            const details = [
              age !== null ? `${age} r.` : null,
              patient.occupation || (patient.work_type ? WORK_TYPES[patient.work_type].split(" (")[0] : null),
              bodyMassIndex !== null ? `BMI ${bodyMassIndex.toLocaleString("sk-SK")}` : null,
            ].filter(Boolean);
            return (
              <li key={patient.id} className="card flex items-start gap-3 p-4 transition hover:ring-teal-600/50">
                <Link
                  href={`/pacienti/${patient.id}`}
                  className="min-w-0 flex-1 focus-visible:outline-2 focus-visible:outline-teal-600"
                >
                  <p className="text-lg font-semibold">
                    {patient.last_name} {patient.first_name}
                  </p>
                  {details.length > 0 && <p className="mt-0.5 text-sm text-slate-600">{details.join(" · ")}</p>}
                  {patient.diagnoses && <p className="mt-2 line-clamp-2 text-sm text-slate-500">{patient.diagnoses}</p>}
                </Link>
                <Link
                  href={aiHref(patient.id)}
                  scroll={false}
                  aria-label={`Opýtať sa AI na pacienta ${patient.first_name} ${patient.last_name}`}
                  className="shrink-0 rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-sm font-semibold text-teal-800 hover:bg-teal-100"
                >
                  AI
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

async function Home({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const { q, pacient } = await searchParams;
  const search = typeof q === "string" ? q.trim() : "";
  const requestedPatient = typeof pacient === "string" && z.uuid().safeParse(pacient).success ? pacient : null;

  const [filtered, everyone] = await Promise.all([listPatients(search), search ? listPatients("") : null]);
  const allPatients = everyone ?? filtered;
  const initialPatientId = allPatients.some((patient) => patient.id === requestedPatient) ? requestedPatient : null;

  return (
    <HomeTabs
      key={initialPatientId ?? "none"}
      initialTab={initialPatientId ? "assistant" : "patients"}
      patients={<PatientList patients={filtered} search={search} />}
      assistant={
        <AssistantPanel
          patients={allPatients.map((patient) => ({
            id: patient.id,
            label: `${patient.last_name} ${patient.first_name}`,
          }))}
          initialPatientId={initialPatientId}
        />
      }
    />
  );
}

export default function HomePage({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<p className="text-slate-500">Načítavam…</p>}>
      <Home searchParams={searchParams} />
    </Suspense>
  );
}
