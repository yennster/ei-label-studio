import type { EISample, LabelTask, LSTask, LSPrediction, LSResult } from "./types";

/** Build the media proxy URL Label Studio fetches (same-origin, cookie-authed). */
export function mediaUrl(projectId: number, sampleId: number, kind: string): string {
  return `/api/ei/media/${projectId}/${sampleId}?kind=${kind}`;
}

/**
 * Convert an EI sample into a Label Studio task. The current EI label is
 * attached as a `prediction` so the labeler sees and can confirm/correct it.
 */
export function sampleToTask(
  sample: EISample,
  projectId: number,
  task: LabelTask,
): LSTask {
  const data: Record<string, string> = {};
  let predictions: LSPrediction[] | undefined;
  let annotations: unknown[] = [];

  if (task === "classify" || task === "detect") {
    data.image = mediaUrl(projectId, sample.id, "image");
  } else if (task === "audio") {
    data.audio = mediaUrl(projectId, sample.id, "audio");
  } else {
    data.timeseries = mediaUrl(projectId, sample.id, "timeseries");
  }

  const hasLabel = sample.label && sample.label !== "unlabeled";

  if (task === "classify" || task === "audio") {
    // Seed the existing label as an editable annotation so the sample opens
    // ready to confirm or correct, with a visible Submit/Update button.
    if (hasLabel) {
      const result: LSResult[] = [
        { from_name: "label", to_name: "media", type: "choices", value: { choices: [sample.label] } },
      ];
      annotations = [{ result }];
    }
  } else if (task === "detect" && sample.boundingBoxes?.length) {
    predictions = [
      {
        model_version: "edge-impulse",
        result: sample.boundingBoxes.map((b) => ({
          from_name: "label",
          to_name: "media",
          type: "rectanglelabels",
          value: {
            x: b.x,
            y: b.y,
            width: b.width,
            height: b.height,
            rotation: 0,
            rectanglelabels: [b.label],
          },
        })),
      },
    ];
  }

  return { id: sample.id, data, predictions, annotations };
}

/**
 * Extract the chosen single-class label from a submitted Label Studio
 * annotation (classify / audio templates).
 */
export function labelFromAnnotation(annotation: unknown): string | null {
  const a = annotation as { result?: Array<{ type?: string; value?: { choices?: string[]; labels?: string[] } }> };
  if (!a?.result) return null;
  for (const r of a.result) {
    if (r.value?.choices?.length) return r.value.choices[0];
    if (r.value?.labels?.length) return r.value.labels[0];
  }
  return null;
}
