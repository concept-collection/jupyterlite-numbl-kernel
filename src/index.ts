import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { IKernelSpecs } from '@jupyterlite/services';
import type { IKernel } from '@jupyterlite/services';

import { NumblKernel } from './kernel';

/** numbl's matrix logo, inlined so the spec needs no served resources. */
const NUMBL_LOGO =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8IS0tIEJhY2tncm91bmQgLS0+CiAgPHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiBmaWxsPSIjNjQ3NDhiIiByeD0iNCIvPgoKICA8IS0tIE1hdHJpeCBicmFja2V0cyBhbmQgZG90cyAod2hpdGUgb24gYmx1ZSkgLS0+CiAgPGcgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIyIiBmaWxsPSJub25lIiBzdHJva2UtbGluZWNhcD0icm91bmQiPgogICAgPCEtLSBMZWZ0IGJyYWNrZXQgLS0+CiAgICA8cGF0aCBkPSJNIDggOSBMIDYgOSBMIDYgMjMgTCA4IDIzIi8+CiAgICA8IS0tIFJpZ2h0IGJyYWNrZXQgLS0+CiAgICA8cGF0aCBkPSJNIDI0IDkgTCAyNiA5IEwgMjYgMjMgTCAyNCAyMyIvPgogIDwvZz4KCiAgPCEtLSBNYXRyaXggZG90cyAtLT4KICA8ZyBmaWxsPSJ3aGl0ZSI+CiAgICA8Y2lyY2xlIGN4PSIxMiIgY3k9IjEzIiByPSIxLjUiLz4KICAgIDxjaXJjbGUgY3g9IjE2IiBjeT0iMTMiIHI9IjEuNSIvPgogICAgPGNpcmNsZSBjeD0iMjAiIGN5PSIxMyIgcj0iMS41Ii8+CgogICAgPGNpcmNsZSBjeD0iMTIiIGN5PSIxOSIgcj0iMS41Ii8+CiAgICA8Y2lyY2xlIGN4PSIxNiIgY3k9IjE5IiByPSIxLjUiLz4KICAgIDxjaXJjbGUgY3g9IjIwIiBjeT0iMTkiIHI9IjEuNSIvPgogIDwvZz4KPC9zdmc+Cg==';

/**
 * A plugin to register the numbl kernel.
 */
const kernel: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlite-numbl-kernel:kernel',
  autoStart: true,
  requires: [IKernelSpecs],
  activate: (app: JupyterFrontEnd, kernelspecs: IKernelSpecs) => {
    kernelspecs.register({
      spec: {
        name: 'numbl',
        display_name: 'numbl (MATLAB syntax)',
        language: 'numbl',
        argv: [],
        resources: {
          'logo-32x32': NUMBL_LOGO,
          'logo-64x64': NUMBL_LOGO
        }
      },
      create: async (options: IKernel.IOptions): Promise<IKernel> => {
        return new NumblKernel(options, app.serviceManager.contents);
      }
    });
  }
};

const plugins: JupyterFrontEndPlugin<unknown>[] = [kernel];

export default plugins;
