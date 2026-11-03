import { createExerciseAction } from "../actions";
import { ExerciseForm } from "../exercise-form";

export default function NewExercisePage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-5 text-2xl font-semibold">Nový cvik</h1>
      <ExerciseForm action={createExerciseAction} submitLabel="Uložiť cvik" />
    </div>
  );
}
