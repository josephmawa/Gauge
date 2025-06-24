import Adw from "gi://Adw";
import Gio from "gi://Gio";
import GObject from "gi://GObject";
import { settings } from "./util.js";

export const GaugePrefsDialog = GObject.registerClass(
  {
    GTypeName: "GaugePrefsDialog",
    Template: getResourceURI("prefs.ui"),
    InternalChildren: ["precision_spin_row"],
  },
  class GaugePrefsDialog extends Adw.PreferencesDialog {
    constructor(options = {}) {
      super(options);
      this.bindSettings();
    }

    bindSettings = () => {
      settings.bind(
        "precision",
        this._precision_spin_row.adjustment,
        "value",
        Gio.SettingsBindFlags.DEFAULT
      );
    };
  }
);
