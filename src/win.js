import Adw from "gi://Adw";
import Gtk from "gi://Gtk";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GObject from "gi://GObject";

import { settings } from "./util.js";

export const GaugeWindow = GObject.registerClass(
  {
    GTypeName: "GaugeWindow",
    Template: getResourceURI("win.ui"),
    InternalChildren: ["split_view", "search_bar"],
  },
  class GaugeWindow extends Adw.ApplicationWindow {
    constructor(application) {
      super({ application });

      this.loadStyles();
      this.bindSettings();
      this.createActions();
      this.setColorScheme();
      this.createColorSchemeAction();
    }

    handleSearch() {
      console.log("Searching...");
    }

    activateUnit() {
      console.log("Ativating unit...");
    }

    createActions = () => {
      const search = Gio.SimpleAction.new("search", null);
      search.connect("activate", () => {
        this._search_bar.search_mode_enabled =
          !this._search_bar.search_mode_enabled;
      });
      this.add_action(search);

      const toggleSidebar = Gio.SimpleAction.new("toggle-sidebar", null);
      toggleSidebar.connect("activate", () => {
        this._split_view.show_sidebar = !this._split_view.show_sidebar;
      });
      this.add_action(toggleSidebar);
    };

    bindSettings = () => {
      settings.bind(
        "window-width",
        this,
        "default-width",
        Gio.SettingsBindFlags.DEFAULT
      );
      settings.bind(
        "window-height",
        this,
        "default-height",
        Gio.SettingsBindFlags.DEFAULT
      );
      settings.bind(
        "window-maximized",
        this,
        "maximized",
        Gio.SettingsBindFlags.DEFAULT
      );
      settings.bind(
        "show-sidebar",
        this._split_view,
        "show-sidebar",
        Gio.SettingsBindFlags.DEFAULT
      );
    };

    createColorSchemeAction = () => {
      this.application.add_action(settings.create_action("color-scheme"));
      settings.connect("changed::color-scheme", this.setColorScheme);
    };

    setColorScheme = () => {
      const styleManager = Adw.StyleManager.get_default();
      styleManager.set_color_scheme(settings.get_int("color-scheme"));
    };

    loadStyles = () => {
      const cssProvider = new Gtk.CssProvider();
      cssProvider.load_from_resource(getResourcePath("index.css"));

      Gtk.StyleContext.add_provider_for_display(
        this.display,
        cssProvider,
        Gtk.STYLE_PROVIDER_PRIORITY_USER
      );
    };
  }
);
