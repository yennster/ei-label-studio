import { describe, it, expect } from "vitest";
import { buildLabelConfig, channelsForSample } from "@/lib/ls-config";
import type { EISample } from "@/lib/types";

describe("buildLabelConfig", () => {
  describe("classify", () => {
    const xml = buildLabelConfig({ task: "classify", labels: ["cat", "dog"] });

    it("uses an Image object bound to the $image data field", () => {
      expect(xml).toContain('<Image name="media" value="$image"');
    });

    it("renders single-choice Choices with one Choice per label", () => {
      expect(xml).toContain('<Choices name="label" toName="media" choice="single"');
      expect(xml).toContain('<Choice value="cat"/>');
      expect(xml).toContain('<Choice value="dog"/>');
    });

    it("does not put background colors on Choice tags", () => {
      expect(xml).not.toContain("background=");
    });
  });

  describe("detect", () => {
    const xml = buildLabelConfig({ task: "detect", labels: ["face", "hand"] });

    it("uses RectangleLabels with a Label per class", () => {
      expect(xml).toContain('<RectangleLabels name="label" toName="media"');
      expect(xml).toContain('<Label value="face"');
      expect(xml).toContain('<Label value="hand"');
    });

    it("assigns palette background colors and cycles them", () => {
      // first two palette entries
      expect(xml).toContain('background="#6366f1"');
      expect(xml).toContain('background="#06b6d4"');
    });

    it("cycles the palette back to the start after 10 labels", () => {
      const labels = Array.from({ length: 11 }, (_, i) => `c${i}`);
      const many = buildLabelConfig({ task: "detect", labels });
      // label index 10 wraps to palette[0]
      expect(many).toContain('<Label value="c10" background="#6366f1"/>');
    });
  });

  describe("audio", () => {
    const xml = buildLabelConfig({ task: "audio", labels: ["yes", "no"] });

    it("uses an Audio object bound to $audio with a space hotkey", () => {
      expect(xml).toContain('<Audio name="media" value="$audio" hotkey="space"/>');
    });

    it("renders Choices for the labels", () => {
      expect(xml).toContain('<Choice value="yes"/>');
      expect(xml).toContain('<Choice value="no"/>');
    });
  });

  describe("timeseries", () => {
    it("renders a TimeSeries with a Channel per provided channel and TimeSeriesLabels", () => {
      const xml = buildLabelConfig({
        task: "timeseries",
        labels: ["walk", "run"],
        channels: ["accX", "accY"],
      });
      expect(xml).toContain('<TimeSeries name="media" value="$timeseries" valueType="url"');
      expect(xml).toContain('<Channel column="accX" legend="accX"');
      expect(xml).toContain('<Channel column="accY" legend="accY"');
      expect(xml).toContain('<TimeSeriesLabels name="label" toName="media">');
      expect(xml).toContain('<Label value="walk"');
    });

    it("defaults to a single `value` channel when none are provided", () => {
      const xml = buildLabelConfig({ task: "timeseries", labels: ["a"] });
      expect(xml).toContain('<Channel column="value" legend="value"');
    });

    it("defaults to a single `value` channel when the channel list is empty", () => {
      const xml = buildLabelConfig({ task: "timeseries", labels: ["a"], channels: [] });
      expect(xml).toContain('<Channel column="value" legend="value"');
    });
  });

  describe("label fallbacks and escaping", () => {
    it("falls back to a single `unlabeled` label when none are given", () => {
      const xml = buildLabelConfig({ task: "classify", labels: [] });
      expect(xml).toContain('<Choice value="unlabeled"/>');
    });

    it("XML-escapes special characters in label values", () => {
      const xml = buildLabelConfig({ task: "classify", labels: ['a & b <"c">'] });
      expect(xml).toContain('value="a &amp; b &lt;&quot;c&quot;&gt;"');
      expect(xml).not.toContain("a & b <");
    });

    it("XML-escapes special characters in channel names", () => {
      const xml = buildLabelConfig({ task: "timeseries", labels: ["a"], channels: ['x&<y'] });
      expect(xml).toContain('column="x&amp;&lt;y"');
    });

    it("wraps every config in a single View root", () => {
      for (const task of ["classify", "detect", "audio", "timeseries"] as const) {
        const xml = buildLabelConfig({ task, labels: ["a"] });
        expect(xml.trim().startsWith("<View>")).toBe(true);
        expect(xml.trim().endsWith("</View>")).toBe(true);
      }
    });
  });
});

describe("channelsForSample", () => {
  function sample(overrides: Partial<EISample> = {}): EISample {
    return { id: 1, filename: "x.csv", label: "a", category: "training", ...overrides };
  }

  it("returns sensor names when present", () => {
    expect(channelsForSample(sample({ sensors: [{ name: "accX" }, { name: "accY" }] }))).toEqual([
      "accX",
      "accY",
    ]);
  });

  it("defaults to [\"value\"] when there are no sensors", () => {
    expect(channelsForSample(sample())).toEqual(["value"]);
    expect(channelsForSample(sample({ sensors: [] }))).toEqual(["value"]);
  });
});
