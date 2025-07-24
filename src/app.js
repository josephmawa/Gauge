import Gio from "gi://Gio";
import GObject from "gi://GObject";
import Adw from "gi://Adw?version=1";

import { GaugeWindow } from "./win.js";
import { AboutDialog } from "./about.js";
import { GaugePrefsDialog } from "./prefs.js";

export const GaugeApplication = GObject.registerClass(
  class GaugeApplication extends Adw.Application {
    constructor() {
      super({
        application_id: pkg.name,
        flags: Gio.ApplicationFlags.DEFAULT_FLAGS,
        resource_base_path: getResourcePath(),
      });

      const quitAction = new Gio.SimpleAction({ name: "quit" });
      quitAction.connect("activate", (action) => {
        this.quit();
      });
      this.add_action(quitAction);

      const prefsAction = new Gio.SimpleAction({ name: "preferences" });
      prefsAction.connect("activate", () => {
        const prefsDialog = new GaugePrefsDialog();
        prefsDialog.present(this.active_window);
      });
      this.add_action(prefsAction);

      const aboutAction = new Gio.SimpleAction({ name: "about" });
      aboutAction.connect("activate", () => {
        const aboutDialog = AboutDialog();
        aboutDialog.present(this.active_window);
      });
      this.add_action(aboutAction);

      this.set_accels_for_action("app.quit", ["<primary>q"]);
      this.set_accels_for_action("app.preferences", ["<primary>comma"]);
      this.set_accels_for_action("win.toggle-sidebar", ["F9"]);
      this.set_accels_for_action("win.search", ["<primary>f"]);
      this.set_accels_for_action("win.switch-units", ["<alt>s"]);
    }

    vfunc_activate() {
      let activeWindow = this.active_window;
      if (!activeWindow) activeWindow = new GaugeWindow(this);
      activeWindow.present();
    }
  }
);
