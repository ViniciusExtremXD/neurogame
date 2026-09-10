import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let load: typeof import("./assetTransport").fetchAnatomyAsset;
const signal = () => new AbortController().signal;
const bytes = () => new Response(Uint8Array.of(19, 11, 50));

beforeEach(async () => {
  vi.useFakeTimers();
  vi.resetModules();
  load = (await import("./assetTransport")).fetchAnatomyAsset;
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// The external network is controlled; Response and its body stream remain real.
function blockedNetwork() {
  const requested: string[] = [];
  const releases: (() => void)[] = [];
  let active = 0,
    maximum = 0;
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    requested.push(url);
    active++;
    maximum = Math.max(maximum, active);
    return new Response(
      new ReadableStream({
        start(controller) {
          let finished = false;
          const abort = () => finish(true);
          function finish(aborted = false) {
            if (finished) return;
            finished = true;
            active--;
            init.signal?.removeEventListener("abort", abort);
            if (aborted) controller.error(init.signal?.reason);
            else {
              controller.enqueue(Uint8Array.of(19, 11, 50));
              controller.close();
            }
          }
          init.signal?.addEventListener("abort", abort, { once: true });
          if (init.signal?.aborted) abort();
          releases.push(finish);
        },
      }),
    );
  });
  return {
    requested,
    get maximum() {
      return maximum;
    },
    async drain() {
      // Each released response permits the next queued request to start.
      for (let round = 0; round < 40; round++) {
        releases.splice(0).forEach((release) => release());
        await vi.advanceTimersByTimeAsync(0);
      }
    },
  };
}

describe("shared anatomy asset transport", () => {
  it("limits 35 simultaneous loads to four through body completion", async () => {
    const network = blockedNetwork();
    const loads = Array.from({ length: 35 }, (_, i) => load(`/mesh-${i}`, signal()));
    await vi.advanceTimersByTimeAsync(0);
    const initiallyStarted = network.requested.length;
    await network.drain();
    const results = await Promise.all(loads);
    expect(initiallyStarted).toBe(4);
    expect(network.maximum).toBe(4);
    expect(results).toHaveLength(35);
    expect([...new Uint8Array(results[34])]).toEqual([19, 11, 50]);
  });

  it("removes an aborted queued request without fetching it or blocking the next", async () => {
    const network = blockedNetwork();
    const running = Array.from({ length: 4 }, (_, i) => load(`/running-${i}`, signal()));
    const controller = new AbortController();
    const cancelled = load("/cancelled", controller.signal).catch((error) => error);
    const next = load("/next", signal());
    controller.abort();
    await vi.advanceTimersByTimeAsync(0);
    await network.drain();
    await Promise.all([...running, next]);
    expect((await cancelled).name).toBe("AbortError");
    expect(network.requested).not.toContain("/cancelled");
    expect(network.requested).toContain("/next");
  });

  it("does not fetch a request already aborted before enqueue", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", async () => { calls++; return bytes(); });
    const controller = new AbortController();
    controller.abort();
    const result = await load("/cancelled", controller.signal).catch((error) => error);
    expect(result.name).toBe("AbortError");
    expect(calls).toBe(0);
  });

  it("releases an active aborted download so queued work can finish", async () => {
    const network = blockedNetwork();
    const controller = new AbortController();
    const cancelled = load("/active", controller.signal).catch((error) => error);
    const remaining = Array.from({ length: 4 }, (_, i) => load(`/remaining-${i}`, signal()));
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    await vi.advanceTimersByTimeAsync(0);
    const startedAfterAbort = [...network.requested];
    await network.drain();
    await Promise.all(remaining);
    expect((await cancelled).name).toBe("AbortError");
    expect(startedAfterAbort).toContain("/remaining-3");
    expect(network.maximum).toBe(4);
  });

  it("recovers two network resets with increasing backoff and no fourth attempt", async () => {
    const times: number[] = [];
    vi.stubGlobal("fetch", async () => {
      times.push(Date.now());
      if (times.length < 3) throw new TypeError("Failed to fetch");
      return bytes();
    });
    const result = load("/reset", signal()).catch((error) => error);
    await vi.runAllTimersAsync();
    expect([...new Uint8Array(await result)]).toEqual([19, 11, 50]);
    expect(times).toHaveLength(3);
    expect(times[1] - times[0]).toBeGreaterThan(0);
    expect(times[2] - times[1]).toBeGreaterThan(times[1] - times[0]);
  });

  it("retries a network reset while reading the body", async () => {
    let attempts = 0;
    vi.stubGlobal("fetch", async () => {
      attempts++;
      return attempts === 1
        ? new Response(new ReadableStream({ start(c) { c.error(new TypeError("terminated")); } }))
        : bytes();
    });
    const result = load("/body-reset", signal()).catch((error) => error);
    await vi.runAllTimersAsync();
    expect([...new Uint8Array(await result)]).toEqual([19, 11, 50]);
    expect(attempts).toBe(2);
  });

  it.each([408, 429, 500, 503, 599])("recovers HTTP %s after backoff", async (status) => {
    let attempts = 0;
    vi.stubGlobal("fetch", async () => ++attempts === 1 ? new Response("retry", { status }) : bytes());
    const result = load("/temporary", signal()).catch((error) => error);
    await vi.runAllTimersAsync();
    expect([...new Uint8Array(await result)]).toEqual([19, 11, 50]);
    expect(attempts).toBe(2);
  });

  it.each([400, 401, 403, 404, 422])("never retries terminal HTTP %s", async (status) => {
    let attempts = 0;
    vi.stubGlobal("fetch", async () => { attempts++; return new Response("terminal", { status }); });
    const result = load("/unavailable", signal()).catch((error) => error);
    await vi.runAllTimersAsync();
    expect((await result).status).toBe(status);
    expect(attempts).toBe(1);
  });

  it.each(["network", "http"])("rejects persistent %s errors after exactly three attempts", async (failure) => {
    let attempts = 0;
    vi.stubGlobal("fetch", async () => {
      attempts++;
      if (failure === "network") throw new TypeError("Failed to fetch");
      return new Response("unavailable", { status: 503 });
    });
    const result = load("/unavailable", signal()).catch((error) => error);
    await vi.runAllTimersAsync();
    expect(await result).toBeInstanceOf(Error);
    expect(attempts).toBe(3);
  });

  it("aborts during backoff without leaving a timer or starting a retry", async () => {
    let attempts = 0;
    vi.stubGlobal("fetch", async () => { attempts++; throw new TypeError("Failed to fetch"); });
    const controller = new AbortController();
    const result = load("/reset", controller.signal).catch((error) => error);
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    await vi.runAllTimersAsync();
    expect((await result).name).toBe("AbortError");
    expect(attempts).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not retry non-network failures", async () => {
    let attempts = 0;
    const error = new SyntaxError("Invalid resource");
    vi.stubGlobal("fetch", async () => { attempts++; throw error; });
    const result = load("/invalid", signal()).catch((cause) => cause);
    await vi.runAllTimersAsync();
    expect(await result).toBe(error);
    expect(attempts).toBe(1);
  });
});
