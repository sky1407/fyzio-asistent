import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { getExercise } from "@/lib/server/exercises";
import { deleteExerciseAction, updateExerciseAction } from "../../actions";
import { ExerciseForm } from "../../exercise-form";

async function EditExercise({ params }: { params: PageProps<"/cviky/[id]/upravit">["params"] }) {
  const { id } = await params;
  const exercise = await getExercise(id);
  if (!exercise) notFound();

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Upraviť cvik</h1>
        <ConfirmDeleteButton
          action={deleteExerciseAction.bind(null, exercise.id)}
          confirmMessage={`Naozaj vymazať cvik „${exercise.name}“ z knižnice? Uložené plány sa nezmenia.`}
        />
      </div>
      <ExerciseForm action={updateExerciseAction.bind(null, exercise.id)} exercise={exercise} submitLabel="Uložiť zmeny" />
    </>
  );
}

export default function EditExercisePage({ params }: PageProps<"/cviky/[id]/upravit">) {
  return (
    <div className="mx-auto max-w-3xl">
      <Suspense fallback={<p className="text-slate-500">Načítavam…</p>}>
        <EditExercise params={params} />
      </Suspense>
    </div>
  );
}
