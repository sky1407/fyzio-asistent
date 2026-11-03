import { createPatientAction } from "../actions";
import { PatientForm } from "../patient-form";

export default function NewPatientPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-5 text-2xl font-semibold">Nový pacient</h1>
      <PatientForm action={createPatientAction} submitLabel="Uložiť pacienta" cancelHref="/" />
    </div>
  );
}
