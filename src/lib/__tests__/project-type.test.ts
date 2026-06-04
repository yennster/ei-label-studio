import { describe, it, expect } from "vitest";
import { labelingMethodLabel, projectTypeLabel, defaultTaskFor } from "@/lib/project-type";
import type { EIProject } from "@/lib/types";

function project(overrides: Partial<EIProject> = {}): EIProject {
  return { id: 1, name: "Demo", ...overrides };
}

describe("labelingMethodLabel", () => {
  it("labels object_detection", () => {
    expect(labelingMethodLabel("object_detection")).toBe("Object detection");
  });

  it("labels label_map as Segmentation", () => {
    expect(labelingMethodLabel("label_map")).toBe("Segmentation");
  });

  it("labels single_label as Classification", () => {
    expect(labelingMethodLabel("single_label")).toBe("Classification");
  });

  it("defaults unknown / undefined methods to Classification", () => {
    expect(labelingMethodLabel("something_else")).toBe("Classification");
    expect(labelingMethodLabel(undefined)).toBe("Classification");
  });
});

describe("projectTypeLabel", () => {
  it("returns an em dash for a null project", () => {
    expect(projectTypeLabel(null)).toBe("—");
  });

  it("returns Object detection for object_detection regardless of modality", () => {
    expect(projectTypeLabel(project({ labelingMethod: "object_detection" }), "image")).toBe("Object detection");
  });

  it("returns Image segmentation for label_map", () => {
    expect(projectTypeLabel(project({ labelingMethod: "label_map" }), "image")).toBe("Image segmentation");
  });

  it("prefixes classification with the modality word", () => {
    expect(projectTypeLabel(project({ labelingMethod: "single_label" }), "image")).toBe("Image classification");
    expect(projectTypeLabel(project(), "audio")).toBe("Audio classification");
    expect(projectTypeLabel(project(), "timeseries")).toBe("Time-series classification");
    expect(projectTypeLabel(project(), "video")).toBe("Video classification");
  });

  it("falls back to plain Classification when modality is unknown or absent", () => {
    expect(projectTypeLabel(project())).toBe("Classification");
    expect(projectTypeLabel(project(), "unknown")).toBe("Classification");
  });
});

describe("defaultTaskFor", () => {
  it("returns sam for an image object-detection project", () => {
    expect(defaultTaskFor("image", "object_detection")).toBe("sam");
  });

  it("returns classify for an image classification project", () => {
    expect(defaultTaskFor("image", "single_label")).toBe("classify");
    expect(defaultTaskFor("image")).toBe("classify");
  });

  it("ignores object_detection for non-image modalities", () => {
    expect(defaultTaskFor("audio", "object_detection")).toBe("audio");
    expect(defaultTaskFor("timeseries", "object_detection")).toBe("timeseries");
  });
});
