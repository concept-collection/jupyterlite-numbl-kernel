# jupyterlite-numbl-kernel

Run [**numbl**](https://numbl.org), numerical computing with **MATLAB
syntax**, in [JupyterLite](https://jupyterlite.readthedocs.io/) notebooks,
**entirely in the browser**, with no server, no kernel process, and nothing
for the reader to install.

numbl is an open-source numerical-computing engine, written in TypeScript,
that uses MATLAB syntax, so `.m` code runs unchanged. This kernel runs a
numbl session in a Web Worker in the page: variables persist across cells,
console output streams into the running cell, plots render as figures in cell
outputs (including interactive 3-D), the `mip` package manager can install
numbl packages from GitHub, and `.m` files next to the notebook are part of
the workspace (named functions, called from cells). Everything runs
client-side.

**Demo site:**
<https://concept-collection.github.io/jupyterlite-numbl-kernel/> (deployed
from this repo via GitHub Pages; see `.github/workflows/deploy.yml`)

## Why

This kernel is a proof of concept that a numbl notebook can be a static web
page: hostable on GitHub Pages, shareable as a link, and executable by anyone
with a browser. Because numbl uses MATLAB syntax and needs no MATLAB/Octave
install (or any server process), the same `.m` code that would otherwise
require a licensed product behind a server just runs in the tab.

## How it works

Three small pieces, all in this repo:

- **Kernel** (`src/kernel.ts`): implements JupyterLite's `BaseKernel` from
  `@jupyterlite/services`. Before each `execute_request`, `.m` files in the
  notebook's directory (read via the JupyterLite contents manager) are
  synced into the numbl session; the cell source then runs against the
  session's persistent workspace (`createNumblSession` /
  `session.execute` from `numbl/browser`, a Web Worker that numbl manages).
  Output streams back as `stream` messages; the run's plot instructions are
  published as `display_data` with the mime type
  `application/vnd.numbl.figure+json`.
- **Figure renderer** (`src/mime.tsx`): a JupyterLab mime renderer for that
  mime type: it replays the instructions through numbl's figures reducer and
  mounts numbl's React `FigureView` (from `numbl/graphics`). Outputs are
  plain JSON, so saved notebooks re-render wherever the extension is
  installed.
- **Kernel registration** (`src/index.ts`): registers the kernelspec with
  JupyterLite's `IKernelSpecs`.

## Build a site with it

```bash
pip install jupyterlite-core jupyterlite-numbl-kernel
jupyter lite build --contents my-notebooks --output-dir dist
# dist/ is a static site; serve it anywhere
```

The `demo/` directory in this repo contains the demo site sources
(notebooks + requirements); `.github/workflows/deploy.yml` builds and
deploys it to GitHub Pages. `demo/content/` is a numbered walkthrough: an
intro (with plotting), a systematic language tour (data types, matrices,
control flow, linear algebra, data structures, numerical methods,
plotting), the advanced MATLAB object model (classes and OOP, namespaces
and packages), and finally installing packages with `mip`. The class and
package `.m` files live next to the notebooks (e.g. `Vec2.m`, `+geom/`,
`@Poly/`) and are synced into the session recursively.

### Always-fresh content (demo choice)

JupyterLite caches content in two layers that both defeat redeploys:

1. It copies notebooks into the browser's IndexedDB on first visit, and that
   local copy then wins over the deployed files **even after a redeploy**.
2. Its **service worker** is an offline caching proxy for the app itself and
   for content files, so it can keep serving the old app and old notebooks
   after a redeploy until it happens to update.

Since this is a demo, `demo/jupyter-lite.json` neutralizes both: it uses
JupyterLite's in-memory storage (so every reload re-seeds the latest
deployed notebooks) and disables the service-worker plugin (which the numbl
kernel doesn't need, since it reads content on the main thread, not via the
service worker's kernel drive):

```json
{
  "jupyter-config-data": {
    "enableMemoryStorage": true,
    "contentsStorageDrivers": ["memoryStorageDriver"],
    "settingsStorageDrivers": ["memoryStorageDriver"],
    "workspacesStorageDrivers": ["memoryStorageDriver"],
    "disabledExtensions": [
      "@jupyterlite/application-extension:service-worker-manager"
    ]
  }
}
```

The trade-off is that a visitor's edits live only for the session and are
discarded on reload. A visitor who loaded the site **before** the service
worker was disabled still has it registered and must clear browser data
(or `Help > Clear Browser Data`) once to get past it. For a real deployment where users should keep their
work, omit these keys (the default persistent storage) and bump
`contentsStorageName` when you want to force-refresh shipped content.
numbl's own package cache (installed via `mip`) lives in a separate
IndexedDB store and is unaffected, so `mip`-installed packages still
persist across reloads.

## Limitations (proof of concept)

- **No interrupt**: a runaway cell can only be stopped by restarting the
  kernel (restart works and gives a fresh workspace). Cooperative
  cancellation exists in numbl but needs `SharedArrayBuffer`, i.e.
  cross-origin isolation headers, which plain GitHub Pages doesn't set.
- **No `input()`** (stdin), for the same reason.
- **Figures are per-cell** (like inline matplotlib): each cell renders the
  figures its own commands produce; `hold on` does not span cells.
- **Named function definitions are not supported inside cells** (a numbl
  REPL limitation): anonymous functions work, and named functions belong in
  `.m` files next to the notebook (see `demo/content/statsutils.m`), which
  this kernel syncs into the session automatically.
- The `.m`-file sync is **one-way**: deleting a `.m` file from the file
  browser leaves its function defined until the kernel restarts, and files
  written by cell code (e.g. via `fopen`) don't appear back in the file
  browser.
- **uihtml** components render display-only; the MATLAB↔HTML event bridge
  is not wired into outputs yet.
- numbl itself is not MATLAB: it covers a large, tested subset of the
  language and toolbox surface. See [numbl](https://numbl.org) for scope.

## Development

Requires Python ≥ 3.9 and NodeJS ≥ 20, and `numbl >= 0.4.14` on npm (the
first release with the incremental `session.execute` browser API). To
develop against an unreleased numbl checkout, run `npm pack` there and
point the `numbl` dependency at the tarball.

```bash
python -m venv .venv && source .venv/bin/activate
pip install "jupyterlab~=4.6.0" "jupyterlite-core==0.8.1"

jlpm install
jlpm build            # tsc + labextension (dev)
pip install -e .      # editable install, registers the labextension

# Build and serve the demo site locally
pip install -r demo/requirements.txt
jupyter lite build --lite-dir demo --contents content --output-dir demo/_output
python -m http.server -d demo/_output 8000
```

`jlpm watch` rebuilds on change during development.

## License

Apache-2.0. Built on [numbl](https://numbl.org) and
the [JupyterLite](https://github.com/jupyterlite/jupyterlite) kernel API;
scaffolding follows the
[jupyterlite/echo-kernel](https://github.com/jupyterlite/echo-kernel)
template.
