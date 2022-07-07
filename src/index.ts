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

/**
 * The command IDs used by the server extension plugin.
 */
namespace CommandIDs {
  export const reprogram = 'webds:reprogram';
}

/**
 * Initialization data for the reprogram extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'reprogram:plugin',
  autoStart: true,
  requires: [ILauncher, ILayoutRestorer, WebDSService],
  activate: (
    app: JupyterFrontEnd,
    launcher: ILauncher,
    restorer: ILayoutRestorer,
	service: WebDSService) => {
    console.log('JupyterLab extension reprogram is activated!');

    let widget: WebDSWidget;
    const { commands, shell } = app;
    const command = CommandIDs.reprogram;
    const category = 'WebDS';
    const extension_string = 'Erase and Program';


    commands.addCommand(command, {
      label: extension_string,
      caption: extension_string,
	  icon: extensionProgramIcon,
      execute: () => {
        if (!widget || widget.isDisposed) {
          let content = new ShellWidget(service);

          widget = new WebDSWidget<ShellWidget>({ content });
          widget.id = 'erase_and_program';
          widget.title.label = extension_string;
          widget.title.closable = true;
          widget.title.icon = extensionProgramIcon;
        }

        if (!tracker.has(widget))
          tracker.add(widget);

        if (!widget.isAttached)
          shell.add(widget, 'main');

        shell.activateById(widget.id);
      }
    });

    // Add launcher
    launcher.add({
      command: command,
      category: category
    });

    let tracker = new WidgetTracker<WebDSWidget>({ namespace: 'webds_reprogram' });
    restorer.restore(tracker, { command, name: () => 'webds_reprogram' });
  }
};

export default plugin;
