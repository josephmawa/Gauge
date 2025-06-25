import Adw from "gi://Adw";
import Gtk from "gi://Gtk";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GObject from "gi://GObject";

import { settings, regexes } from "./util.js";

export const GaugeWindow = GObject.registerClass(
  {
    GTypeName: "GaugeWindow",
    Template: getResourceURI("win.ui"),
    InternalChildren: [
      "split_view",
      "search_bar",
      "input_entry",
      "output_entry",
    ],
  },
  class GaugeWindow extends Adw.ApplicationWindow {
    constructor(application) {
      super({ application });

      this.loadStyles();
      this.bindSettings();
      this.createActions();
      this.setColorScheme();
      this.createColorSchemeAction();

      /**
       * NOTE
       * You can't connect insert-text event to Gtk.Entry directly.
       * Read more about it in the following reference docs:
       * • https://gitlab.gnome.org/GNOME/gtk/-/issues/4315
       * • https://docs.gtk.org/gtk4/iface.Editable.html#implementing-gtkeditable
       */
      this._input_entry
        .get_delegate()
        .connect("insert-text", this.insertTextHandler);

      this._output_entry
        .get_delegate()
        .connect("insert-text", this.insertTextHandler);
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

    wordChanged(entry) {
      console.log(entry instanceof Gtk.Entry);
      entry.set_position(-1);
    }

    insertTextHandler = (editable, text, length, position) => {
      const signalId = GObject.signal_lookup("insert-text", editable);
      const handlerId = GObject.signal_handler_find(
        editable,
        GObject.SignalMatchType.ID,
        signalId,
        GLib.quark_to_string(0),
        null,
        null,
        null
      );
      GObject.signal_handler_block(editable, handlerId);

      if (regexes.validDigit.test(text)) {
        /**
         * We only allow these characters: /[-+eE0-9]/.
         * Therefore, the text entry will contain ASCII
         * and the spread syntax will split the string
         * into actual characters.
         */
        const characters = [...editable.text];
        const cursorPosition = editable.get_position();
        characters.splice(cursorPosition, 0, text);
        const bufferText = characters.join("");

        if (regexes.validEntry.test(bufferText)) {
          editable.insert_text(text, text.length, cursorPosition);
        }
      }

      GObject.signal_handler_unblock(editable, handlerId);
      GObject.signal_stop_emission(editable, signalId, GLib.quark_to_string(0));
    };

    createToast = (timeout = 1) => {
      this.toast = new Adw.Toast({ timeout });
    };

    displayToast = (message) => {
      this.toast.dismiss();
      this.toast.title = message;
      this._toast_overlay.add_toast(this.toast);
    };

    debounce = (callback, wait = 300) => {
      let debounceTimeout = null;

      return (...args) => {
        if (debounceTimeout) {
          GLib.source_remove(debounceTimeout);
        }

        debounceTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, wait, () => {
          callback(...args);
          debounceTimeout = null;
          return GLib.SOURCE_REMOVE;
        });
      };
    };
  }
);
