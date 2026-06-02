import { describe, it, expect } from "vitest";
import { detectModality, defaultTaskForModality } from "@/lib/modality";
import type { EISample } from "@/lib/types";

function sample(overrides: Partial<EISample> = {}): EISample {
  return {
    id: 1,
    filename: "x.bin",
    label: "a",
    category: "training",
    ...overrides,
  };
}

describe("detectModality", () => {
  describe("by chartType", () => {
    it("maps image chartType to image", () => {
      expect(detectModality(sample({ chartType: "image" }))).toBe("image");
    });

    it("maps video chartType to video", () => {
      expect(detectModality(sample({ chartType: "video" }))).toBe("video");
    });

    it("treats a high-frequency chart as audio", () => {
      expect(detectModality(sample({ chartType: "chart", frequency: 16000 }))).toBe("audio");
    });

    it("uses 8000 Hz as the inclusive audio threshold", () => {
      expect(detectModality(sample({ chartType: "chart", frequency: 8000 }))).toBe("audio");
      expect(detectModality(sample({ chartType: "chart", frequency: 7999 }))).toBe("timeseries");
    });

    it("treats a single audio-named sensor as audio regardless of frequency", () => {
      expect(
        detectModality(sample({ chartType: "chart", frequency: 100, sensors: [{ name: "microphone" }] })),
      ).toBe("audio");
    });

    it("treats a low-frequency multi-axis chart as timeseries", () => {
      expect(
        detectModality(
          sample({
            chartType: "chart",
            frequency: 100,
            sensors: [{ name: "accX" }, { name: "accY" }, { name: "accZ" }],
          }),
        ),
      ).toBe("timeseries");
    });

    it("does not treat a multi-axis sensor set as audio even if one is named audio", () => {
      // axes > 1 so the name-based audio path is not taken, and frequency is low
      expect(
        detectModality(
          sample({ chartType: "table", frequency: 100, sensors: [{ name: "audio" }, { name: "other" }] }),
        ),
      ).toBe("timeseries");
    });

    it("treats a table chartType like a chart", () => {
      expect(detectModality(sample({ chartType: "table", frequency: 44100 }))).toBe("audio");
    });
  });

  describe("by filename extension (no chartType)", () => {
    it.each(["photo.jpg", "photo.JPEG", "img.png", "i.bmp", "a.gif", "p.webp"])(
      "detects image for %s",
      (filename) => {
        expect(detectModality(sample({ filename }))).toBe("image");
      },
    );

    it.each(["clip.wav", "clip.mp3", "a.ogg", "b.flac", "c.m4a"])("detects audio for %s", (filename) => {
      expect(detectModality(sample({ filename }))).toBe("audio");
    });

    it.each(["movie.mp4", "x.avi", "y.mov", "z.webm"])("detects video for %s", (filename) => {
      expect(detectModality(sample({ filename }))).toBe("video");
    });

    it.each(["data.csv", "data.json", "data.cbor"])("detects timeseries for %s", (filename) => {
      expect(detectModality(sample({ filename }))).toBe("timeseries");
    });

    it("returns unknown for an unrecognized extension", () => {
      expect(detectModality(sample({ filename: "mystery.xyz" }))).toBe("unknown");
    });

    it("returns unknown when there is no extension", () => {
      expect(detectModality(sample({ filename: "noextension" }))).toBe("unknown");
    });
  });
});

describe("defaultTaskForModality", () => {
  it("maps image to classify", () => {
    expect(defaultTaskForModality("image")).toBe("classify");
  });

  it("maps audio to audio", () => {
    expect(defaultTaskForModality("audio")).toBe("audio");
  });

  it("maps timeseries to timeseries", () => {
    expect(defaultTaskForModality("timeseries")).toBe("timeseries");
  });

  it("falls back to classify for video and unknown", () => {
    expect(defaultTaskForModality("video")).toBe("classify");
    expect(defaultTaskForModality("unknown")).toBe("classify");
  });
});
