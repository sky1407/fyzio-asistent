import { ACTIVITY_LEVELS, SEXES, WORK_TYPES, ageFromBirthYear, bmi, bmiCategory, type Patient } from "@/lib/patients/model";

export const SYSTEM_PROMPT = `Si AI asistent fyzioterapeutky, ktorá je zároveň fitness trénerka. Pomáhaš jej analyzovať stav pacientov a pripravovať rehabilitačné plány, tréningy a odporúčania pre stravu.

Pravidlá:
- Píšeš pre odborníčku. Odpovedaj vždy po slovensky, vecne a prehľadne v Markdown (nadpisy, odrážky, tabuľky, ak sa hodia).
- Nestanovuješ diagnózy ani liečbu, iba navrhuješ. Rozhodnutie je vždy na terapeutke.
- Ak údaje naznačujú varovné príznaky (red flags, napr. nočná alebo kľudová bolesť, strata citlivosti či sily, poruchy močenia, nevysvetliteľný úbytok hmotnosti, bolesť na hrudi), jasne ich označ a odporuč lekárske vyšetrenie.
- Vždy rešpektuj diagnózy, obmedzenia a kontraindikácie pacienta. Ak je cvik rizikový, uveď prečo a navrhni bezpečnejšiu alternatívu.
- Pri každom cviku uveď: názov, stručný popis vykonania, série × opakovania alebo čas, frekvenciu za týždeň, na čo si dať pozor a odkaz na vyhľadanie videa v tvare [Video](https://www.youtube.com/results?search_query=nazov+cviku). Nikdy nevymýšľaj priame odkazy na konkrétne videá.
- Zohľadni typ práce: pri sedavej práci krčnú a hrudnú chrbticu, flexory bedra a sedacie svaly; pri stojacej práci chodidlá, žily a driek; pri ťažkej manuálnej práci kompenzáciu preťaženia, regeneráciu a techniku dvíhania.
- Pri strave dávaj všeobecné odporúčania a orientačný jedálniček, nie liečebnú diétu. Pri ochoreniach vyžadujúcich diétu (napr. diabetes, ochorenia obličiek, dna) odporuč konzultáciu s lekárom alebo nutričným terapeutom.
- Ak chýbajú dôležité údaje, krátko sa na ne opýtaj alebo uveď, s akým predpokladom počítaš.
- Údaje pacienta sú anonymizované. Nikdy nežiadaj meno ani iné identifikačné údaje.`;

function line(label: string, value: string | null): string | null {
  return value ? `- ${label}: ${value}` : null;
}

function block(label: string, value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? `- ${label}:\n${trimmed.replace(/^/gm, "  ")}` : null;
}

export function buildPatientContext(patient: Patient, now: Date = new Date()): string {
  const age = ageFromBirthYear(patient.birth_year, now);
  const bodyMassIndex = bmi(patient.height_cm, patient.weight_kg);
  const category = bmiCategory(bodyMassIndex);

  const lines = [
    line("Pohlavie", patient.sex ? SEXES[patient.sex].toLowerCase() : null),
    line("Vek", age === null ? null : `${age} rokov`),
    line("Výška", patient.height_cm === null ? null : `${patient.height_cm} cm`),
    line("Váha", patient.weight_kg === null ? null : `${patient.weight_kg} kg`),
    line("BMI", bodyMassIndex === null ? null : `${bodyMassIndex} (${category})`),
    line("Zamestnanie", patient.occupation || null),
    line("Typ pracovnej záťaže", patient.work_type ? WORK_TYPES[patient.work_type] : null),
    line("Pohybová aktivita mimo práce", patient.activity_level ? ACTIVITY_LEVELS[patient.activity_level] : null),
    block("Diagnózy", patient.diagnoses),
    block("Obmedzenia a kontraindikácie", patient.limitations),
    block("Ciele", patient.goals),
    block("Poznámky terapeutky", patient.notes),
  ].filter((value): value is string => value !== null);

  return lines.length > 0
    ? `## Profil pacienta (anonymizovaný)\n${lines.join("\n")}`
    : "## Profil pacienta (anonymizovaný)\nO pacientovi zatiaľ nie sú vyplnené žiadne údaje.";
}

export type LibraryExercise = { name: string; target: string };

export const LIBRARY_LIMIT = 150;

export function buildLibraryContext(library: LibraryExercise[]): string | null {
  if (library.length === 0) return null;
  const lines = library
    .slice(0, LIBRARY_LIMIT)
    .map((exercise) => `- ${exercise.name}${exercise.target ? ` – ${exercise.target}` : ""}`);
  return `## Knižnica cvikov terapeutky
Ak sa cvik z knižnice hodí pre pacienta, uprednostni ho a použi presne tento názov. Ďalšie cviky navrhni, iba ak v knižnici chýba vhodný.
${lines.join("\n")}`;
}

export function buildSystemInstruction(
  patient: Patient | null,
  library: LibraryExercise[] = [],
  now: Date = new Date(),
): string {
  const context = patient
    ? buildPatientContext(patient, now)
    : "Tento rozhovor nie je viazaný na konkrétneho pacienta. Odpovedaj všeobecne.";
  return [SYSTEM_PROMPT, context, buildLibraryContext(library)].filter(Boolean).join("\n\n");
}
