import type { EIProject, LabelTask, Modality } from "./types";
import { defaultTaskForModality } from "./modality";

/** Human label for the EI labeling method on its own (no modality known yet). */
export function labelingMethodLabel(method?: string): string {
  switch (method) {
    case "object_detection":
      return "Object detection";
    case "label_map":
      return "Segmentation";
    case "single_label":
    default:
      return "Classification";
  }
}

function modalityWord(m?: Modality): string | null {
  switch (m) {
    case "image":
      return "Image";
    case "audio":
      return "Audio";
    case "timeseries":
      return "Time-series";
    case "video":
      return "Video";
    default:
      return null;
  }
}

/**
 * Full project-type label, e.g. "Image classification", "Object detection",
 * "Audio classification". Object detection / segmentation already imply image,
 * so the modality prefix is dropped for those.
 */
export function projectTypeLabel(project: EIProject | null, modality?: Modality): string {
  if (!project) return "—";
  const method = project.labelingMethod;
  if (method === "object_detection") return "Object detection";
  if (method === "label_map") return "Image segmentation";
  const word = modalityWord(modality);
  return word ? `${word} classification` : "Classification";
}

/** Default labeling template, factoring in the project's labeling method. */
export function defaultTaskFor(modality: Modality, labelingMethod?: string): LabelTask {
  if (modality === "image" && labelingMethod === "object_detection") return "sam";
  return defaultTaskForModality(modality);
}
