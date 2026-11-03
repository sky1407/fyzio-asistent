import { describe, expect, it } from "vitest";
import { ExerciseInputSchema, exerciseKey, youtubeSearchUrl } from "./model";

describe("ExerciseInputSchema", () => {
  it("accepts a minimal exercise and fills defaults", () => {
    expect(ExerciseInputSchema.parse({ name: " Mostík " })).toEqual({
      name: "Mostík",
      description: "",
      target: "",
      video_url: "",
    });
  });

  it("accepts an https video link", () => {
    expect(ExerciseInputSchema.parse({ name: "A", video_url: " https://youtu.be/abc " }).video_url).toBe(
      "https://youtu.be/abc",
    );
  });

  it("rejects an empty name and unsafe or incomplete links", () => {
    for (const video_url of ["javascript:alert(1)", "youtube.com/watch", "ftp://x.sk/a"]) {
      expect(ExerciseInputSchema.safeParse({ name: "A", video_url }).success).toBe(false);
    }
    expect(ExerciseInputSchema.safeParse({ name: "  " }).success).toBe(false);
  });
});

describe("exerciseKey", () => {
  it("treats case, diacritics, punctuation and parenthesised names as equal", () => {
    const key = exerciseKey("Mostík");
    for (const variant of ["Mostík (Glute Bridge)", "mostik", "MOSTÍK", "  Mostík. "]) {
      expect(exerciseKey(variant)).toBe(key);
    }
    expect(exerciseKey("Mačací chrbát")).toBe("macaci chrbat");
    expect(exerciseKey("Mostík na jednej nohe")).not.toBe(key);
  });
});

describe("youtubeSearchUrl", () => {
  it("encodes the exercise name", () => {
    expect(youtubeSearchUrl("Mačací chrbát")).toBe(
      "https://www.youtube.com/results?search_query=Ma%C4%8Dac%C3%AD+chrb%C3%A1t",
    );
  });
});
