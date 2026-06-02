import type { EISample, LabelTask, Modality } from "./types";

/**
 * Infer the data modality of an EI sample from its metadata.
 * EI exposes `chartType` (chart | image | video | table) plus sensor/frequency
 * info, which together distinguish image / audio / time-series cleanly.
 */
export function detectModality(sample: EISample): Modality {
  switch (sample.chartType) {
    case "image":
      return "image";
    case "video":
      return "video";
    case "chart":
    case "table": {
      // Audio is a high-frequency single-axis signal. Everything else with a
      // chart is treated as multi-axis time-series.
      const freq = sample.frequency ?? 0;
      const axes = sample.sensors?.length ?? 0;
      const looksAudio =
        freq >= 8000 ||
        (axes <= 1 && /audio|microphone|mic|sound/i.test(sample.sensors?.[0]?.name ?? ""));
      return looksAudio ? "audio" : "timeseries";
    }
    default: {
      // No chartType — fall back to the filename extension.
      const ext = sample.filename.split(".").pop()?.toLowerCase() ?? "";
      if (["jpg", "jpeg", "png", "bmp", "gif", "webp"].includes(ext)) return "image";
      if (["wav", "mp3", "ogg", "flac", "m4a"].includes(ext)) return "audio";
      if (["mp4", "avi", "mov", "webm"].includes(ext)) return "video";
      if (["csv", "json", "cbor"].includes(ext)) return "timeseries";
      return "unknown";
    }
  }
}

/** Map a modality to the most natural labeling template. */
export function defaultTaskForModality(m: Modality): LabelTask {
  switch (m) {
    case "image":
      return "classify";
    case "audio":
      return "audio";
    case "timeseries":
      return "timeseries";
    default:
      return "classify";
  }
}
