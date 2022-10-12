import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
  ILayoutRestorer
} from '@jupyterlab/application';

import { WidgetTracker } from '@jupyterlab/apputils';

import { ILauncher } from '@jupyterlab/launcher';

import { ShellWidget } from './widget'

import { extensionProgramIcon } from './icons';

import { WebDSService, WebDSWidget } from '@webds/service';

namespace Attributes {
  export const command = "webds_reprogram:open";
  export const id = "webds_reprogram_widget";
  export const label = "Erase and Program";
  export const caption = "Erase and Program";
  export const category = 'Firmware Install';
  export const rank = 10;
}

/**
 * Initialization data for the reprogram extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'reprogram:plugin',
  autoStart: true,
  requires: [ILauncher, ILayoutRestorer, WebDSService],
  activate: async (
    app: JupyterFrontEnd,
    launcher: ILauncher,
    restorer: ILayoutRestorer,
	service: WebDSService) => {

    if (service.pinormos.getOSInfo().current.version.endsWith("E")) {
      return;
    } else {
      console.log('JupyterLab extension reprogram is activated!');
    }

    let widget: WebDSWidget;
    const { commands, shell } = app;
    const command = Attributes.command;

    commands.addCommand(command, {
      label: Attributes.label,
      caption: Attributes.caption,
	  icon: extensionProgramIcon,
      execute: () => {
        if (!widget || widget.isDisposed) {
          let content = new ShellWidget(Attributes.id, service);

          widget = new WebDSWidget<ShellWidget>({ content });
          widget.id = Attributes.id;
          widget.title.label = Attributes.label;
          widget.title.closable = true;
          widget.title.icon = extensionProgramIcon;
        }

        if (!tracker.has(widget))
          tracker.add(widget);

        if (!widget.isAttached)
          shell.add(widget, 'main');

        shell.activateById(widget.id);

        widget.setShadows();
      }
    });

    // Add launcher
    launcher.add({
      command: command,
      category: Attributes.category,
      rank: Attributes.rank
    });

    let tracker = new WidgetTracker<WebDSWidget>({ namespace: Attributes.id });
    restorer.restore(tracker, { command, name: () => Attributes.id });
  }
};

export default plugin;
