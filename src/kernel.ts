import type { Contents, KernelMessage } from '@jupyterlab/services';

import { BaseKernel } from '@jupyterlite/services';
import type { IKernel } from '@jupyterlite/services';

import { createNumblSession } from 'numbl/browser';
import type { NumblSession } from 'numbl/browser';

import { registerInterruptor, unregisterInterruptor } from './interruptBridge';

/** Mime type carrying a cell's plot instructions (see src/mime.tsx). */
export const FIGURE_MIME = 'application/vnd.numbl.figure+json';

/**
 * A JupyterLite kernel that runs numbl (a MATLAB-syntax numerical
 * computing engine) entirely in the browser.
 *
 * Each kernel owns one numbl session (a Web Worker managed by numbl):
 * variables persist across cells, console output streams to the running
 * cell, and figures are published as display_data with the numbl figure
 * mime type. Restarting the kernel disposes the session, so the next
 * execution boots a fresh workspace.
 *
 * Before every execution, `.m` files sitting next to the notebook (in the
 * JupyterLite contents) are synced into the session, so named functions can
 * be defined in the file browser, edited in the Jupyter editor, and called
 * from cells. numbl rescans the working directory on each execution, so
 * edits apply on the next run. The sync is one-way and additive: deleting a
 * `.m` file leaves its function defined until the kernel restarts.
 */
export class NumblKernel extends BaseKernel {
  /**
   * @param options Standard kernel options.
   * @param contents The (browser-side) contents manager used to read `.m`
   * workspace files from the notebook's directory.
   */
  constructor(options: IKernel.IOptions, contents?: Contents.IManager) {
    super(options);
    this._contents = contents ?? null;
    // Let the interrupt bridge stop this kernel's running cell (the Stop
    // button reaches us out of band; see src/interruptBridge.ts).
    registerInterruptor(this.id, () => this.interrupt());
  }
  /**
   * Handle a kernel_info_request message.
   */
  async kernelInfoRequest(): Promise<KernelMessage.IInfoReplyMsg['content']> {
    const content: KernelMessage.IInfoReply = {
      implementation: 'numbl',
      implementation_version: '0.1.0',
      language_info: {
        // numbl uses MATLAB syntax; the octave/matlab modes drive
        // highlighting in the notebook and on nbconvert export.
        codemirror_mode: 'octave',
        file_extension: '.m',
        mimetype: 'text/x-octave',
        name: 'numbl',
        nbconvert_exporter: 'script',
        pygments_lexer: 'matlab',
        version: 'numbl'
      },
      protocol_version: '5.3',
      status: 'ok',
      banner:
        'numbl: MATLAB-syntax numerical computing, running in the browser',
      help_links: [
        {
          text: 'numbl',
          url: 'https://numbl.org'
        }
      ]
    };
    return content;
  }

  /**
   * Handle an `execute_request` message: run the cell against the numbl
   * session's persistent workspace.
   */
  async executeRequest(
    content: KernelMessage.IExecuteRequestMsg['content']
  ): Promise<KernelMessage.IExecuteReplyMsg['content']> {
    let session: NumblSession;
    try {
      session = await this._sessionPromise();
    } catch (err) {
      // Boot failure (e.g. the mip download was unreachable). Reset so a
      // later cell can retry, and report the failure on this cell.
      this._session = null;
      const message = err instanceof Error ? err.message : String(err);
      return this._errorReply(
        'SessionError',
        `Failed to start numbl: ${message}`
      );
    }

    await this._syncWorkspaceFiles(session);
    const result = await session.execute(content.code);

    if (result.aborted) {
      // The Stop button interrupted this cell (cooperative cancellation via
      // the shared cancel flag). numbl left the workspace at its pre-run
      // state, so variables from before the cell survive. Report it the way
      // an interrupted cell is reported elsewhere: a KeyboardInterrupt.
      return this._errorReply(
        'KeyboardInterrupt',
        result.error ?? 'Execution interrupted'
      );
    }

    if (!result.ok) {
      return this._errorReply('NumblError', result.error ?? 'Unknown error');
    }

    if (result.plotInstructions.length > 0) {
      // Round-trip through JSON so the live render path sees exactly what a
      // reloaded notebook sees (structured-clone NaNs become nulls; the
      // renderer restores them).
      const instructions = JSON.parse(JSON.stringify(result.plotInstructions));
      this.displayData({
        data: {
          [FIGURE_MIME]: { version: 1, plotInstructions: instructions },
          'text/plain':
            '<numbl figure (install jupyterlite-numbl-kernel to render)>'
        },
        metadata: {}
      });
    }

    return {
      status: 'ok',
      execution_count: this.executionCount,
      user_expressions: {}
    };
  }

  /**
   * Handle a `complete_request` message. Completion is not implemented.
   */
  async completeRequest(
    content: KernelMessage.ICompleteRequestMsg['content']
  ): Promise<KernelMessage.ICompleteReplyMsg['content']> {
    return {
      status: 'ok',
      matches: [],
      cursor_start: content.cursor_pos,
      cursor_end: content.cursor_pos,
      metadata: {}
    };
  }

  /**
   * Handle an `inspect_request` message. Inspection is not implemented.
   */
  async inspectRequest(
    content: KernelMessage.IInspectRequestMsg['content']
  ): Promise<KernelMessage.IInspectReplyMsg['content']> {
    return { status: 'ok', found: false, data: {}, metadata: {} };
  }

  /**
   * Handle an `is_complete_request` message: treat every submission as a
   * complete numbl statement (the console runs on Enter).
   */
  async isCompleteRequest(
    content: KernelMessage.IIsCompleteRequestMsg['content']
  ): Promise<KernelMessage.IIsCompleteReplyMsg['content']> {
    return { status: 'complete' };
  }

  /**
   * Handle a `comm_info_request` message. Comms are not implemented.
   */
  async commInfoRequest(
    content: KernelMessage.ICommInfoRequestMsg['content']
  ): Promise<KernelMessage.ICommInfoReplyMsg['content']> {
    return { status: 'ok', comms: {} };
  }

  /**
   * Handle an `input_reply`: hand the user's line to the numbl worker, which
   * is blocked inside `input()` waiting for it. JupyterLite delivers
   * `input_reply` out of band (it bypasses the message mutex that the running
   * cell's `execute_request` still holds), so this arrives mid-execution as
   * intended. Requires cross-origin isolation; without it `input()` errors in
   * numbl before ever prompting, so this is never reached.
   */
  inputReply(content: KernelMessage.IInputReplyMsg['content']): void {
    const value =
      'value' in content && typeof content.value === 'string'
        ? content.value
        : '';
    void this._session
      ?.then(session => session.provideInput(value))
      .catch(() => undefined);
  }

  async commOpen(msg: KernelMessage.ICommOpenMsg): Promise<void> {
    // no-op
  }

  async commMsg(msg: KernelMessage.ICommMsgMsg): Promise<void> {
    // no-op
  }

  async commClose(msg: KernelMessage.ICommCloseMsg): Promise<void> {
    // no-op
  }

  /**
   * Cooperatively interrupt the running cell. Signals the numbl session to
   * abort its current `execute` at the next loop iteration or function call,
   * leaving the persistent workspace intact (the interrupted cell resolves
   * with `aborted: true`, reported as a KeyboardInterrupt). Invoked out of
   * band by the interrupt bridge, since JupyterLite can't message a busy
   * kernel (see src/interruptBridge.ts).
   *
   * A no-op when no run is in flight, or when the page is not cross-origin
   * isolated — then `SharedArrayBuffer` is unavailable, `session.interrupt()`
   * can't signal the worker, and a runaway cell can still only be stopped by
   * restarting the kernel.
   */
  interrupt(): void {
    void this._session
      ?.then(session => session.interrupt())
      .catch(() => undefined);
  }

  /**
   * Dispose the kernel and its numbl session (worker).
   */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    unregisterInterruptor(this.id);
    void this._session?.then(s => s.dispose()).catch(() => undefined);
    this._session = null;
    super.dispose();
  }

  /**
   * Sync `.m` files from the notebook's directory (recursively) into the
   * session VFS, preserving the relative layout. Recursing matters for
   * MATLAB's folder-based constructs: `+namespace/`, `@class/`, and
   * `private/` folders all live in subdirectories and must reach the
   * session at the right paths. numbl rescans its working directory on
   * every execution, so a file written here is callable on this same
   * execute() call, and an edit in the Jupyter editor takes effect on the
   * next run. Best-effort: a contents-manager error (e.g. no browser drive
   * mounted) just skips the sync rather than failing the cell.
   */
  private async _syncWorkspaceFiles(session: NumblSession): Promise<void> {
    if (!this._contents) {
      return;
    }
    const root = this.location;
    const rootPrefix = root ? root.replace(/\/$/, '') + '/' : '';

    const syncDir = async (dir: string): Promise<void> => {
      let listing: Contents.IModel;
      try {
        listing = await this._contents!.get(dir, { content: true });
      } catch {
        return;
      }
      const entries = Array.isArray(listing.content) ? listing.content : [];
      for (const entry of entries as Contents.IModel[]) {
        if (entry.type === 'directory') {
          await syncDir(entry.path);
          continue;
        }
        if (entry.type !== 'file' || !entry.name.endsWith('.m')) {
          continue;
        }
        if (this._syncedMTimes.get(entry.path) === entry.last_modified) {
          continue;
        }
        try {
          const file = await this._contents!.get(entry.path, {
            content: true,
            type: 'file',
            format: 'text'
          });
          // Write at the path relative to the notebook directory so that
          // +pkg/@class/private layouts land correctly under the session root.
          const rel = entry.path.startsWith(rootPrefix)
            ? entry.path.slice(rootPrefix.length)
            : entry.name;
          session.writeFile(rel, String(file.content));
          this._syncedMTimes.set(entry.path, entry.last_modified);
        } catch {
          // Skip this file; other workspace files still sync.
        }
      }
    };

    await syncDir(root);
  }

  /**
   * Boot the numbl session lazily on first use, so creating the kernel is
   * instant and boot progress (mip download, cached-package restore) streams
   * into the first executed cell.
   */
  private _sessionPromise(): Promise<NumblSession> {
    this._session ??= createNumblSession({
      onOutput: text => this.stream({ name: 'stdout', text }),
      onProgress: message =>
        this.stream({ name: 'stdout', text: `[numbl] ${message}\n` }),
      // `input()` in the running cell: prompt the front end. The worker is
      // blocked waiting for the reply, which arrives via inputReply().
      onInputRequest: prompt => this.inputRequest({ prompt, password: false })
    });
    return this._session;
  }

  private _errorReply(
    ename: string,
    formatted: string
  ): KernelMessage.IExecuteReplyMsg['content'] {
    const traceback = formatted.split('\n');
    const evalue = traceback[0] ?? '';
    this.publishExecuteError({ ename, evalue, traceback });
    return {
      status: 'error',
      execution_count: this.executionCount,
      ename,
      evalue,
      traceback
    };
  }

  private _session: Promise<NumblSession> | null = null;
  private readonly _contents: Contents.IManager | null;
  private readonly _syncedMTimes = new Map<string, string>();
}
