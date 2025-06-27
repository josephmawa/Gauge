import Adw from "gi://Adw";
import Gtk from "gi://Gtk";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GObject from "gi://GObject";

import { settings, regexes, CursorState } from "./util.js";
import { units } from "./units.js";

export const GaugeWindow = GObject.registerClass(
  {
    GTypeName: "GaugeWindow",
    Template: getResourceURI("win.ui"),
    InternalChildren: ["split_view", "search_bar", "entryA", "entryB"],
  },
  class GaugeWindow extends Adw.ApplicationWindow {
    constructor(application) {
      super({ application });

      this.loadStyles();
      this.bindSettings();
      this.createActions();
      this.setColorScheme();
      this.connectHandlers();
      this.createColorSchemeAction();
    }

    handleSearch() {
      console.log("Searching...");
    }

    activateUnit() {
      console.log("Ativating unit...");
    }

    connectHandlers = () => {
      const initialCursorState = { position: -1, update: false };
      const entryAcursorState = new CursorState(initialCursorState);
      const entryBcursorstate = new CursorState(initialCursorState);
      /**
       * NOTE
       * You can't connect insert-text event to Gtk.Entry directly.
       * Read more about it in the following reference docs:
       * • https://gitlab.gnome.org/GNOME/gtk/-/issues/4315
       * • https://docs.gtk.org/gtk4/iface.Editable.html#implementing-gtkeditable
       */
      this._entryA.get_delegate().connect("insert-text", (...args) => {
        this.insertText(...args, entryAcursorState);
      });
      this._entryB.get_delegate().connect("insert-text", (...args) => {
        this.insertText(...args, entryBcursorstate);
      });

      this._entryA.buffer.bind_property_full(
        "text",
        this._entryB.buffer,
        "text",
        GObject.BindingFlags.BIDIRECTIONAL | GObject.BindingFlags.SYNC_CREATE,
        (binding, text) => {
          if (!text) return [true, text];
          const convertedText = text.length.toString();
          return [true, convertedText];
        },
        (binding, text) => {
          if (!text) return [true, text];
          const convertedText = text.length.toString();
          return [true, convertedText];
        }
      );

      this._entryA.connect("changed", (entry) => {
        this.setCursorPosition(entry, entryAcursorState);
      });
      this._entryB.connect("changed", (entry) => {
        this.setCursorPosition(entry, entryBcursorstate);
      });
    };

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

    setCursorPosition = (entry, entryCursorState) => {
      if (entryCursorState.update) {
        entry.set_position(entryCursorState.position);
        entryCursorState.update = false;
      }
    };

    insertText = (editable, text, length, position, entryCursorState) => {
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

        if (regexes.validEntry.test(characters.join(""))) {
          editable.insert_text(text, length, cursorPosition);
          entryCursorState.position = cursorPosition + length;
          entryCursorState.update = true;
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
