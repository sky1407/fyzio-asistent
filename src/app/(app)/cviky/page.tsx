import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { youtubeSearchUrl } from "@/lib/exercises/model";
import { listExercises } from "@/lib/server/exercises";

async function ExerciseList({ searchParams }: { searchParams: PageProps<"/cviky">["searchParams"] }) {
  const { q } = await searchParams;
  const search = typeof q === "string" ? q.trim() : "";
  const exercises = await listExercises(search);

  return (
    <>
      <Form action="/cviky" className="mb-4 flex gap-2" role="search">
        <input
          key={search}
          name="q"
          type="search"
          defaultValue={search}
          placeholder="Hľadať cvik, zameranie alebo popis…"
          aria-label="Hľadať cvik"
          className="field-input"
        />
        <button type="submit" className="btn-secondary shrink-0">
          Hľadať
        </button>
      </Form>

      {exercises.length === 0 ? (
        <div className="card text-center text-slate-600">
          {search ? (
            <p>
              Pre „{search}“ sa nenašiel žiadny cvik.{" "}
              <Link href="/cviky" className="font-medium text-teal-700 underline">
                Zobraziť všetky
              </Link>
            </p>
          ) : (
            <p>
              Knižnica je zatiaľ prázdna. Pridajte cvik ručne alebo ho vytiahnite z uloženého plánu tlačidlom „Vytiahnuť
              cviky do knižnice“.
            </p>
          )}
        </div>
      ) : (
        <>
          <p className="mb-3 text-sm text-slate-500">Počet cvikov: {exercises.length}</p>
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {exercises.map((exercise) => (
              <li key={exercise.id} className="card flex flex-col gap-2 p-4">
                <p className="text-lg font-semibold">{exercise.name}</p>
                {exercise.target && <p className="text-sm font-medium text-teal-800">{exercise.target}</p>}
                {exercise.description && (
                  <p className="line-clamp-4 whitespace-pre-line text-sm text-slate-600">{exercise.description}</p>
                )}
                <div className="mt-auto flex flex-wrap gap-2 pt-2">
                  <a
                    href={exercise.video_url || youtubeSearchUrl(exercise.name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary px-3 py-1.5 text-sm"
                  >
                    {exercise.video_url ? "Video" : "Hľadať video"}
                  </a>
                  <Link href={`/cviky/${exercise.id}/upravit`} className="btn-secondary px-3 py-1.5 text-sm">
                    Upraviť
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

export default function ExercisesPage({ searchParams }: PageProps<"/cviky">) {
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Knižnica cvikov</h1>
        <Link href="/cviky/novy" className="btn-primary">
          + Nový cvik
        </Link>
      </div>
      <Suspense fallback={<p className="text-slate-500">Načítavam cviky…</p>}>
        <ExerciseList searchParams={searchParams} />
      </Suspense>
    </>
  );
}
