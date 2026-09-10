type QueuedDownload = { start: () => void };

// One queue serves every mounted scene in this browser module. A slot stays
// occupied until the response body finishes, not just until headers arrive.
const queue: QueuedDownload[] = [];
let active = 0;
const concurrency = 4;

class AssetHttpError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Não foi possível obter um modelo anatômico (HTTP ${status}).`);
    this.name = "AssetHttpError";
    this.status = status;
  }
}

function acquire(signal: AbortSignal): Promise<() => void> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const entry: QueuedDownload = {
      start() {
        signal.removeEventListener("abort", abort);
        active++;
        resolve(() => {
          active--;
          queue.shift()?.start();
        });
      },
    };
    function abort() {
      const index = queue.indexOf(entry);
      if (index !== -1) queue.splice(index, 1);
      signal.removeEventListener("abort", abort);
      reject(signal.reason);
    }
    if (active < concurrency) entry.start();
    else {
      queue.push(entry);
      signal.addEventListener("abort", abort, { once: true });
    }
  });
}

function backoff(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, milliseconds);
    function abort() {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      reject(signal.reason);
    }
    signal.addEventListener("abort", abort, { once: true });
  });
}

function transient(cause: unknown) {
  if (cause instanceof AssetHttpError)
    return (
      cause.status === 408 ||
      cause.status === 429 ||
      (cause.status >= 500 && cause.status <= 599)
    );
  // Fetch and body-stream network failures reject with TypeError. GLB parsing
  // and geometry validation deliberately happen outside this transport.
  return cause instanceof TypeError;
}

async function download(url: string, signal: AbortSignal) {
  const release = await acquire(signal);
  try {
    signal.throwIfAborted();
    const response = await fetch(url, { signal });
    if (!response.ok) {
      // Cancel an error page rather than leave its body downloading after the
      // slot is released. Its HTTP status decides whether another try is valid.
      await response.body?.cancel().catch(() => {});
      throw new AssetHttpError(response.status);
    }
    const bytes = await response.arrayBuffer();
    signal.throwIfAborted();
    return bytes;
  } finally {
    release();
  }
}

/** At most three attempts; cancellation also removes queued work and backoff. */
export async function fetchAnatomyAsset(url: string, signal: AbortSignal) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await download(url, signal);
    } catch (cause) {
      signal.throwIfAborted();
      if (attempt >= 2 || !transient(cause)) throw cause;
      // Waiting happens outside the download slot so unrelated work can finish.
      await backoff(300 * 2 ** attempt, signal);
    }
  }
}
