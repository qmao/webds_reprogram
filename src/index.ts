import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
  ILayoutRestorer
} from '@jupyterlab/application';

import { ISettingRegistry } from '@jupyterlab/settingregistry';

import { MainAreaWidget, WidgetTracker } from '@jupyterlab/apputils';

import { ILauncher } from '@jupyterlab/launcher';

import { ShellWidget } from './widget'

import { extensionProgramIcon } from './icons';

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
  optional: [ISettingRegistry],
  requires: [ILauncher, ILayoutRestorer],  
  activate: (
    app: JupyterFrontEnd,
    launcher: ILauncher,
    restorer: ILayoutRestorer,
    settingRegistry: ISettingRegistry | null) => {
    console.log('JupyterLab extension reprogram is activated!');

    if (settingRegistry) {
        console.log(settingRegistry);
        /*
        settingRegistry
        .load(plugin.id)
        .then(settings => {
          console.log('reprogram settings loaded:', settings.composite);
        })
        .catch(reason => {
          console.error('Failed to load settings for reprogram.', reason);
        });
        */
    }

    let widget: MainAreaWidget;
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
          let content = new ShellWidget();

          widget = new MainAreaWidget<ShellWidget>({ content });
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

    let tracker = new WidgetTracker<MainAreaWidget>({ namespace: 'webds_reprogram' });
    restorer.restore(tracker, { command, name: () => 'webds_reprogram' });
  }
};

export default plugin;
