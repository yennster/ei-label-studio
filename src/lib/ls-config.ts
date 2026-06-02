import type { EISample, LabelTask } from "./types";

const PALETTE = [
  "#6366f1", "#06b6d4", "#ec4899", "#22c55e", "#f59e0b",
  "#a855f7", "#ef4444", "#14b8a6", "#3b82f6", "#eab308",
];

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function labelTags(labels: string[], tag: "Choice" | "Label"): string {
  return labels
    .map((l, i) => {
      const bg = tag === "Label" ? ` background="${PALETTE[i % PALETTE.length]}"` : "";
      return `    <${tag} value="${esc(l)}"${bg}/>`;
    })
    .join("\n");
}

/**
 * Build a Label Studio labeling config (XML) for the chosen task, given the
 * set of class labels and (for time-series) the sensor channels.
 *
 * The object tag's `value` references a `data.*` field that our task mapper
 * fills with a same-origin media proxy URL.
 */
export function buildLabelConfig(opts: {
  task: LabelTask;
  labels: string[];
  channels?: string[];
}): string {
  const labels = opts.labels.length ? opts.labels : ["unlabeled"];

  switch (opts.task) {
    case "classify":
      return `<View>
  <Image name="media" value="$image" zoom="true" zoomControl="true"/>
  <Header value="Choose a class"/>
  <Choices name="label" toName="media" choice="single" showInLine="true">
${labelTags(labels, "Choice")}
  </Choices>
</View>`;

    case "detect":
      return `<View>
  <Image name="media" value="$image" zoom="true" zoomControl="true"/>
  <RectangleLabels name="label" toName="media" strokeWidth="3" opacity="0.4">
${labelTags(labels, "Label")}
  </RectangleLabels>
</View>`;

    case "audio":
      return `<View>
  <Audio name="media" value="$audio" hotkey="space"/>
  <Header value="Choose a class"/>
  <Choices name="label" toName="media" choice="single" showInLine="true">
${labelTags(labels, "Choice")}
  </Choices>
</View>`;

    case "timeseries": {
      const channels = opts.channels?.length ? opts.channels : ["value"];
      const channelTags = channels
        .map(
          (c, i) =>
            `    <Channel column="${esc(c)}" legend="${esc(c)}" strokeColor="${PALETTE[i % PALETTE.length]}"/>`,
        )
        .join("\n");
      return `<View>
  <TimeSeries name="media" value="$timeseries" valueType="url" timeColumn="time" sep=",">
${channelTags}
  </TimeSeries>
  <TimeSeriesLabels name="label" toName="media">
${labelTags(labels, "Label")}
  </TimeSeriesLabels>
</View>`;
    }
  }
}

/** Channel/column names for a time-series sample (sensor axis names). */
export function channelsForSample(sample: EISample): string[] {
  if (sample.sensors?.length) return sample.sensors.map((s) => s.name);
  return ["value"];
}
