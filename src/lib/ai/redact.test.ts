import { describe, expect, it } from "vitest";
import {
  BIRTH_NUMBER_PLACEHOLDER,
  EMAIL_PLACEHOLDER,
  PATIENT_PLACEHOLDER,
  PHONE_PLACEHOLDER,
  buildRedactor,
} from "./redact";

describe("buildRedactor", () => {
  const redact = buildRedactor(["Jana", "Nováková"]);

  it("removes the patient's full name", () => {
    expect(redact("Pacientka Jana Nováková má bolesti chrbta.")).toBe(
      `Pacientka ${PATIENT_PLACEHOLDER} má bolesti chrbta.`,
    );
  });

  it("removes declined and diacritic-insensitive forms", () => {
    expect(redact("Konzultácia s Novákovou, poznámky od Jany.")).toBe(
      `Konzultácia s ${PATIENT_PLACEHOLDER}, poznámky od ${PATIENT_PLACEHOLDER}.`,
    );
  });

  it("removes the Slovak birth number", () => {
    expect(redact("RČ 860515/1234 je v karte.")).toBe(`RČ ${BIRTH_NUMBER_PLACEHOLDER} je v karte.`);
  });

  it("removes phone numbers and e-mails", () => {
    expect(redact("Volať 0905 123 456 alebo jana@example.sk")).toBe(
      `Volať ${PHONE_PLACEHOLDER} alebo ${EMAIL_PLACEHOLDER}`,
    );
    expect(redact("tel. +421 905 123 456")).toBe(`tel. ${PHONE_PLACEHOLDER}`);
  });

  it("keeps clinical numbers and ordinary words untouched", () => {
    const text = "3 série × 12 opakovaní, výška 168 cm, váha 72 kg, rok 2010.";
    expect(redact(text)).toBe(text);
  });

  it("still redacts structural data when no name is known", () => {
    const redactNoNames = buildRedactor();
    expect(redactNoNames("Kontakt: fyzio@klinika.sk, 0911222333")).toBe(
      `Kontakt: ${EMAIL_PLACEHOLDER}, ${PHONE_PLACEHOLDER}`,
    );
    expect(redactNoNames("Jana Nováková")).toBe("Jana Nováková");
  });

  it("does not touch short common words for a long surname", () => {
    expect(redact("Má a je to tak.")).toBe("Má a je to tak.");
  });
});
