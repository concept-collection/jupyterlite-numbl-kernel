import { KernelConnection } from '@jupyterlab/services';

/**
 * Bridge that lets a *running* numbl cell be interrupted.
 *
 * JupyterLite (0.8.x) has no in-band way to interrupt a running kernel: its
 * `LiteKernelClient` serializes every kernel message through a single
 * `async-mutex`, and `interrupt()` only calls `mutex.cancel()`, which rejects
 * *queued* messages — the in-flight cell that holds the lock is never
 * signaled. `BaseKernel` has no `interrupt_request` handler either, so no
 * Jupyter message (control channel included) reaches a busy kernel.
 *
 * But the in-browser kernel object and the front end share the main-thread JS
 * realm, so we deliver the interrupt *out of band*. Every UI interrupt path —
 * the notebook/console toolbar Stop button, the Kernel menu, the
 * `*:interrupt-kernel` commands — funnels through
 * `KernelConnection.interrupt()`. We wrap that single method so it first
 * signals the matching numbl kernel (registered here by id) and then delegates
 * to the original, which still performs JupyterLite's queued-cell
 * cancellation. The numbl side cooperatively aborts the current run via a
 * shared `SharedArrayBuffer`, preserving the workspace.
 */

/** Interrupt callbacks by kernel id (matches `BaseKernel.id`, which equals the
 *  front-end `KernelConnection.id`). */
const interruptors = new Map<string, () => void>();

/** Register a kernel's interrupt callback. Call again to replace. */
export function registerInterruptor(id: string, interrupt: () => void): void {
  interruptors.set(id, interrupt);
}

/** Drop a kernel's interrupt callback (on dispose). */
export function unregisterInterruptor(id: string): void {
  interruptors.delete(id);
}

let bridgeInstalled = false;

/**
 * Patch `KernelConnection.prototype.interrupt` once so interrupting a kernel
 * also signals the registered numbl kernel of the same id. Idempotent.
 * `KernelConnection` is a shared singleton from `@jupyterlab/services`, so the
 * patch applies to every connection the app creates.
 */
export function installInterruptBridge(): void {
  if (bridgeInstalled) {
    return;
  }
  bridgeInstalled = true;

  const proto = KernelConnection.prototype as unknown as {
    interrupt(...args: unknown[]): Promise<void>;
  };
  const original = proto.interrupt;
  proto.interrupt = function (
    this: { id: string },
    ...args: unknown[]
  ): Promise<void> {
    try {
      interruptors.get(this.id)?.();
    } catch {
      // Never let interrupt signaling break the built-in interrupt path.
    }
    return original.apply(this, args);
  };
}
