import type { IRenderMime } from '@jupyterlab/rendermime-interfaces';

import { Widget } from '@lumino/widgets';

import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';

import {
  FigureView,
  figuresReducer,
  initialFiguresState,
  restoreNaNs
} from 'numbl/graphics';
import type { FigureState, PlotInstruction } from 'numbl/graphics';

/** Mime type carrying a cell's plot instructions (emitted by the kernel). */
export const FIGURE_MIME = 'application/vnd.numbl.figure+json';

/**
 * Render one cell's plot instructions: replay them through numbl's figures
 * reducer (from an empty state — figures are per-cell, like inline
 * matplotlib) and mount numbl's React figure renderer for each resulting
 * figure. Outputs are plain JSON, so saved notebooks re-render on reload
 * wherever this extension is installed.
 */
class NumblFigureRenderer extends Widget implements IRenderMime.IRenderer {
  constructor() {
    super();
    this.addClass('numbl-figure-output');
  }

  async renderModel(model: IRenderMime.IMimeModel): Promise<void> {
    const payload = model.data[FIGURE_MIME] as
      { plotInstructions?: PlotInstruction[] } | undefined;
    // Clone before mutating: mime model data is shared, and restoreNaNs
    // rewrites in place the nulls that JSON made of NaNs.
    const instructions: PlotInstruction[] = JSON.parse(
      JSON.stringify(payload?.plotInstructions ?? [])
    );

    let state = initialFiguresState;
    for (const instruction of instructions) {
      restoreNaNs(instruction);
      state = figuresReducer(state, instruction);
    }
    const figures: FigureState[] = Object.keys(state.figs)
      .map(Number)
      .sort((a, b) => a - b)
      .map(handle => state.figs[handle]);

    this._root ??= createRoot(this.node);
    this._root.render(
      <>
        {figures.map((figure, i) => (
          <div className="numbl-figure" key={i}>
            <FigureView figure={figure} />
          </div>
        ))}
      </>
    );
  }

  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    // Unmount asynchronously: dispose can be called from within a React
    // lifecycle, where a synchronous unmount is not allowed.
    const root = this._root;
    this._root = null;
    if (root) {
      setTimeout(() => root.unmount(), 0);
    }
    super.dispose();
  }

  private _root: Root | null = null;
}

/**
 * The numbl figure mime renderer factory. `safe: false` because uihtml
 * figures embed author-provided HTML (rendered only in trusted notebooks).
 */
export const rendererFactory: IRenderMime.IRendererFactory = {
  safe: false,
  mimeTypes: [FIGURE_MIME],
  createRenderer: () => new NumblFigureRenderer()
};

const extension: IRenderMime.IExtension = {
  id: 'jupyterlite-numbl-kernel:figure-renderer',
  rendererFactory,
  rank: 0,
  dataType: 'json'
};

export default extension;
