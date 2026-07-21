# jupyterlite-numbl-kernel

Run [**numbl**](https://numbl.org) — numerical computing with **MATLAB
syntax** — in [JupyterLite](https://jupyterlite.readthedocs.io/) notebooks,
**entirely in the browser**. No server, no kernel process, nothing for the
reader to install.

numbl is an open-source numerical-computing engine, written in TypeScript,
that uses MATLAB syntax, so `.m` code runs unchanged. This kernel runs a numbl
session in a Web Worker on the page: variables persist across cells, console
output streams into the running cell, plots render as figures (including
interactive 3-D), and `.m` files next to the notebook are part of the
workspace (named functions, called from cells). Everything runs client-side.

**Demo:** <https://concept-collection.github.io/jupyterlite-numbl-kernel/>
(deployed from this repo via GitHub Pages)

## Why

A numbl notebook can be a static web page: hostable on GitHub Pages, shareable
as a link, and runnable by anyone with a browser. Because numbl uses MATLAB
syntax and needs no MATLAB/Octave install (or any server), the same `.m` code
that would otherwise sit behind a licensed product just runs in the tab.

## How it works

Three small pieces, all in `src/`:

- **Kernel** ([kernel.ts](src/kernel.ts)) implements JupyterLite's
  `BaseKernel`. Before each cell runs, `.m` files in the notebook's directory
  are synced into the numbl session; the cell then runs against the session's
  persistent workspace (a Web Worker that numbl manages). Console output
  streams back as `stream` messages, and plots are published as `display_data`
  with the mime type `application/vnd.numbl.figure+json`.
- **Figure renderer** ([mime.tsx](src/mime.tsx)) is a mime renderer for that
  type: it replays the plot instructions and mounts numbl's React `FigureView`.
  Outputs are plain JSON, so saved notebooks re-render wherever the extension
  is installed.
- **Registration** ([index.ts](src/index.ts)) registers the kernelspec.

## Build a site with it

```bash
pip install jupyterlite-core jupyterlite-numbl-kernel
jupyter lite build --contents my-notebooks --output-dir dist
# dist/ is a static site; serve it anywhere
```

`.m` files next to a notebook are synced into the session recursively, so
MATLAB's folder-based `+namespace/`, `@class/`, and `private/` layouts work as
expected.

The `demo/` directory is the source of the demo site above — a numbered
walkthrough of the language and the MATLAB object model (classes, namespaces,
packages). [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
builds and deploys it to GitHub Pages.

### Fresh content on redeploy (demo choice)

JupyterLite caches notebooks in the browser (IndexedDB) and can keep serving
stale copies from its service worker even after a redeploy. Because this is a
demo, [`demo/jupyter-lite.json`](demo/jupyter-lite.json) uses in-memory
storage and disables the service worker, so every reload re-seeds the latest
deployed notebooks. The trade-off is that a visitor's edits last only for the
session. For a real deployment where users keep their work, drop those
settings and use JupyterLite's default persistent storage.

### Cross-origin isolation (for interrupt and input)

The Stop button and `input()` both rely on a `SharedArrayBuffer`, which
browsers expose only on a **cross-origin-isolated** page (`COOP`/`COEP`
headers). GitHub Pages can't set those headers, so the demo ships a small
service worker, [`demo/coi-serviceworker.js`](demo/coi-serviceworker.js)
(based on [coi-serviceworker](https://github.com/niccokunzmann/coi-serviceworker)),
that synthesizes them client-side; [`demo/inject-coi.mjs`](demo/inject-coi.mjs)
wires it into every generated page during the build. Without isolation,
interrupt and `input()` degrade gracefully (see Limitations).

## Limitations (proof of concept)

- **Interrupt** is cooperative: the Stop button aborts the running cell at the
  next loop iteration or function call, reports a `KeyboardInterrupt`, and
  leaves earlier variables intact. It needs cross-origin isolation (above); on
  a non-isolated page it's a no-op, and a tight loop with no calls (e.g.
  `while true; x = x + 1; end`) has no checkpoint to abort at — both cases need
  a kernel restart.
- **`input()`** prompts in the notebook and blocks until you answer. It also
  needs cross-origin isolation; without it, `input()` raises rather than
  prompting.
- **Figures are per-cell** (like inline matplotlib): `hold on` does not span
  cells.
- **Named functions go in `.m` files**, not cells (a numbl REPL limitation);
  anonymous functions work in cells. See [`demo/content/fib.m`](demo/content/fib.m).
- **`.m` sync is one-way**: deleting a file leaves its function defined until
  the kernel restarts, and files written by cell code don't appear back in the
  file browser.
- **numbl is not MATLAB** — it covers a large, tested subset of the language
  and toolboxes. See [numbl](https://numbl.org) for scope.

## Development

Requires Python ≥ 3.9, Node ≥ 20, and `numbl >= 0.4.16`.

```bash
python -m venv .venv && source .venv/bin/activate
pip install "jupyterlab~=4.6.0" "jupyterlite-core==0.8.1"

jlpm install
jlpm build            # tsc + labextension (dev)
pip install -e .      # editable install, registers the labextension

# Build and serve the demo site locally
pip install -r demo/requirements.txt
jupyter lite build --lite-dir demo --contents content --output-dir demo/_output
node demo/inject-coi.mjs demo/_output   # cross-origin isolation, for interrupt
python -m http.server -d demo/_output 8000   # then open http://localhost:8000
```

`jlpm watch` rebuilds on change during development.

## License

Apache-2.0. Built on [numbl](https://numbl.org) and
[JupyterLite](https://github.com/jupyterlite/jupyterlite); scaffolded from the
[jupyterlite/echo-kernel](https://github.com/jupyterlite/echo-kernel) template.
