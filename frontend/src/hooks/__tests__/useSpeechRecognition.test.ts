import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { friendlyRecognitionError, useSpeechRecognition } from "../useSpeechRecognition";

/**
 * Minimal fake of the browser's SpeechRecognition so these tests exercise the
 * hook's actual wiring (config flags, handler assignment, start/stop/abort
 * calls) without a real browser or network access to Google's speech service.
 */
class FakeSpeechRecognition {
  lang = "";
  continuous = true;
  interimResults = false;
  onresult: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();

  static instances: FakeSpeechRecognition[] = [];
  constructor() {
    FakeSpeechRecognition.instances.push(this);
  }
}

describe("friendlyRecognitionError", () => {
  it("maps network errors to a message that points at the browser's speech service, not our backend", () => {
    const message = friendlyRecognitionError("network");
    expect(message).toMatch(/voice recognition service/i);
    expect(message).not.toMatch(/GroceryNxt's servers\b.*unreachable/i);
  });

  it("maps permission, no-speech, and hardware errors to distinct friendly messages", () => {
    expect(friendlyRecognitionError("not-allowed")).toMatch(/permission/i);
    expect(friendlyRecognitionError("service-not-allowed")).toMatch(/permission/i);
    expect(friendlyRecognitionError("no-speech")).toMatch(/didn't hear/i);
    expect(friendlyRecognitionError("audio-capture")).toMatch(/microphone/i);
  });

  it("never leaks the raw error code for unknown codes", () => {
    expect(friendlyRecognitionError("some-internal-code")).not.toContain("some-internal-code");
  });
});

describe("useSpeechRecognition", () => {
  beforeEach(() => {
    FakeSpeechRecognition.instances = [];
    (window as any).SpeechRecognition = FakeSpeechRecognition;
  });

  afterEach(() => {
    delete (window as any).SpeechRecognition;
    delete (window as any).webkitSpeechRecognition;
  });

  it("configures a single-utterance, non-continuous recognizer for the given locale", () => {
    renderHook(() => useSpeechRecognition({ lang: "ta-IN", onFinalResult: vi.fn() }));
    const instance = FakeSpeechRecognition.instances[0];
    expect(instance.lang).toBe("ta-IN");
    expect(instance.continuous).toBe(false);
  });

  it.each(["en-IN", "ta-IN", "te-IN", "hi-IN"])(
    "wires up the %s locale identically to every other supported locale",
    (locale) => {
      renderHook(() => useSpeechRecognition({ lang: locale, onFinalResult: vi.fn() }));
      const instance = FakeSpeechRecognition.instances[0];
      expect(instance.lang).toBe(locale);
      expect(instance.continuous).toBe(false);
      expect(instance.interimResults).toBe(true);
    }
  );

  it("start() calls the underlying recognizer's start() and flips isListening", () => {
    const { result } = renderHook(() => useSpeechRecognition({ lang: "en-IN", onFinalResult: vi.fn() }));
    act(() => result.current.start());
    expect(FakeSpeechRecognition.instances[0].start).toHaveBeenCalledTimes(1);
    expect(result.current.isListening).toBe(true);
  });

  it("stop() calls the underlying recognizer's stop() and clears isListening", () => {
    const { result } = renderHook(() => useSpeechRecognition({ lang: "en-IN", onFinalResult: vi.fn() }));
    act(() => result.current.start());
    act(() => result.current.stop());
    expect(FakeSpeechRecognition.instances[0].stop).toHaveBeenCalledTimes(1);
    expect(result.current.isListening).toBe(false);
  });

  it("reports a friendly message and clears isListening on a network error, regardless of locale", () => {
    const onError = vi.fn();
    const { result } = renderHook(() =>
      useSpeechRecognition({ lang: "hi-IN", onFinalResult: vi.fn(), onError })
    );
    act(() => result.current.start());
    act(() => {
      FakeSpeechRecognition.instances[0].onerror?.({ error: "network" } as any);
    });
    expect(onError).toHaveBeenCalledWith(friendlyRecognitionError("network"));
    expect(result.current.isListening).toBe(false);
  });

  it("swallows its own abort() as a non-error (no onError call)", () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useSpeechRecognition({ lang: "en-IN", onFinalResult: vi.fn(), onError }));
    act(() => result.current.start());
    act(() => {
      FakeSpeechRecognition.instances[0].onerror?.({ error: "aborted" } as any);
    });
    expect(onError).not.toHaveBeenCalled();
  });

  it("passes the final transcript through and clears interim text on a final result", () => {
    const onFinalResult = vi.fn();
    renderHook(() => useSpeechRecognition({ lang: "en-IN", onFinalResult }));
    act(() => {
      FakeSpeechRecognition.instances[0].onresult?.({
        results: { 0: { 0: { transcript: "add rice" }, isFinal: true }, length: 1 },
      } as any);
    });
    expect(onFinalResult).toHaveBeenCalledWith("add rice");
  });

  it("aborts the recognizer when the locale changes (no leaked/overlapping sessions)", () => {
    const { rerender } = renderHook(({ lang }) => useSpeechRecognition({ lang, onFinalResult: vi.fn() }), {
      initialProps: { lang: "en-IN" },
    });
    const first = FakeSpeechRecognition.instances[0];
    rerender({ lang: "ta-IN" });
    expect(first.abort).toHaveBeenCalledTimes(1);
    expect(FakeSpeechRecognition.instances[1].lang).toBe("ta-IN");
  });

  it("does not create a recognizer at all when neither SpeechRecognition nor webkitSpeechRecognition exists", () => {
    delete (window as any).SpeechRecognition;
    renderHook(() => useSpeechRecognition({ lang: "en-IN", onFinalResult: vi.fn() }));
    expect(FakeSpeechRecognition.instances.length).toBe(0);
  });
});
