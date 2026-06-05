import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getIframeQueryParams } from "../url-params";

describe("getIframeQueryParams", () => {
  const originalSelf = window.self;
  const originalTop = window.top;
  const originalParent = window.parent;

  beforeEach(() => {
    // Reset properties on window to default state before each test
    Object.defineProperty(window, "self", { value: originalSelf, configurable: true, writable: true });
    Object.defineProperty(window, "top", { value: originalTop, configurable: true, writable: true });
    Object.defineProperty(window, "parent", { value: originalParent, configurable: true, writable: true });
  });

  afterEach(() => {
    // Restore
    Object.defineProperty(window, "self", { value: originalSelf, configurable: true });
    Object.defineProperty(window, "top", { value: originalTop, configurable: true });
    Object.defineProperty(window, "parent", { value: originalParent, configurable: true });
    
    // Reset location search
    const url = new URL(window.location.href);
    url.search = "";
    window.history.replaceState({}, "", url.toString());
  });

  it("reads parameters from window.location.search when not in an iframe", () => {
    // Set window search string
    const url = new URL(window.location.href);
    url.search = "?theme=dark&project=123";
    window.history.replaceState({}, "", url.toString());

    // Mock top and self to be equal (meaning not in an iframe)
    Object.defineProperty(window, "self", { value: window, configurable: true });
    Object.defineProperty(window, "top", { value: window, configurable: true });

    const params = getIframeQueryParams();
    expect(params.get("theme")).toBe("dark");
    expect(params.get("project")).toBe("123");
  });

  it("reads and merges parameters from window.parent.location.search when inside a same-origin iframe", () => {
    // Set iframe window search string
    const url = new URL(window.location.href);
    url.search = "?theme=light&category=training";
    window.history.replaceState({}, "", url.toString());

    // Mock top and self to be different (meaning inside an iframe)
    const mockTop = { isTop: true };
    const mockParent = {
      location: {
        search: "?theme=dark&project=456",
      },
    };

    Object.defineProperty(window, "self", { value: window, configurable: true });
    Object.defineProperty(window, "top", { value: mockTop, configurable: true });
    Object.defineProperty(window, "parent", { value: mockParent, configurable: true });

    const params = getIframeQueryParams();
    // Parent should merge and override iframe params
    expect(params.get("theme")).toBe("dark");
    expect(params.get("project")).toBe("456");
    expect(params.get("category")).toBe("training");
  });

  it("gracefully falls back to current window parameters when access to window.parent throws a security exception", () => {
    // Set iframe window search string
    const url = new URL(window.location.href);
    url.search = "?theme=light&category=training";
    window.history.replaceState({}, "", url.toString());

    // Mock top and self to be different (meaning inside an iframe)
    const mockTop = { isTop: true };

    Object.defineProperty(window, "self", { value: window, configurable: true });
    Object.defineProperty(window, "top", { value: mockTop, configurable: true });
    
    // Getter on parent throws a cross-origin DOMException
    Object.defineProperty(window, "parent", {
      configurable: true,
      get() {
        throw new Error("Blocked a frame with origin from accessing a cross-origin frame.");
      },
    });

    const params = getIframeQueryParams();
    // Should fallback to iframe's own params
    expect(params.get("theme")).toBe("light");
    expect(params.get("category")).toBe("training");
    expect(params.get("project")).toBeNull();
  });
});
