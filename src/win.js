import Adw from "gi://Adw";
import Gtk from "gi://Gtk";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GObject from "gi://GObject";

import { settings, regexes, CursorState, processUnits } from "./util.js";
import { units } from "./units.js";
import { Unit } from "./gobjects.js";

export const GaugeWindow = GObject.registerClass(
  {
    GTypeName: "GaugeWindow",
    Template: getResourceURI("win.ui"),
    InternalChildren: [
      "split_view",
      "list_view",
      "search_bar",
      "entryA",
      "entryB",
    ],
  },
  class GaugeWindow extends Adw.ApplicationWindow {
    constructor(application) {
      super({ application });

      this.loadStyles();
      this.bindSettings();
      this.createSidebar();
      this.createActions();
      this.setColorScheme();
      this.connectHandlers();
      this.createColorSchemeAction();
    }

    handleSearch() {
      console.log("Searching...");
    }

    activateUnit(listView, position) {
      const item = listView.model.selected_item.item;
      if (item.children.length) {
        console.log("Top level unit");
      }

      if (!item.children.length) {
        console.log("Inner level unit");
      }
    }

    createSidebar = () => {
      const processedUnits = processUnits(units);
      const store = Gio.ListStore.new(Unit);

      for (const unit of processedUnits) {
        store.append(new Unit(unit));
      }

      const customFilter = Gtk.CustomFilter.new(null);
      const filter = Gtk.FilterListModel.new(store, customFilter);

      const tree = Gtk.TreeListModel.new(filter, false, false, (item) => {
        if (!item.children.length) return null;

        const nestedStore = Gio.ListStore.new(Unit);
        const nestedModel = Gtk.FilterListModel.new(nestedStore, customFilter);

        for (const unit of item.children) {
          nestedModel.model.append(new Unit(unit));
        }
        return nestedModel;
      });

      const selection = Gtk.SingleSelection.new(tree);
      const factory = new Gtk.SignalListItemFactory();

      factory.connect("setup", (factory, listItem) => {
        const hBox = new Gtk.Box({
          orientation: Gtk.Orientation.HORIZONTAL,
          halign: Gtk.Align.FILL,
        });

        const hBoxInner1 = new Gtk.Box({
          orientation: Gtk.Orientation.HORIZONTAL,
          halign: Gtk.Align.START,
          hexpand: true,
        });
        const hBoxInner2 = new Gtk.Box({
          orientation: Gtk.Orientation.HORIZONTAL,
          halign: Gtk.Align.END,
          hexpand: true,
        });

        const label = new Gtk.Label();
        // const icon = new Gtk.Image({
        //   icon_name: "egghead-object-select-symbolic",
        //   visible: false,
        //   pixel_size: 12,
        // });

        hBoxInner1.append(label);
        // hBoxInner2.append(icon);

        hBox.append(hBoxInner1);
        // hBox.append(hBoxInner2);

        listItem.child = new Gtk.TreeExpander({ child: hBox });
      });

      factory.connect("bind", (_, listItem) => {
        const listRow = listItem.item;
        const expander = listItem.child;

        expander.list_row = listRow;

        const hBox = expander.child;
        const label = hBox?.get_first_child()?.get_first_child();
        // const image = hBox?.get_last_child()?.get_first_child();
        const object = listRow.item;

        // this.bind_property_full(
        //   "category_id",
        //   image,
        //   "visible",
        //   GObject.BindingFlags.DEFAULT || GObject.BindingFlags.SYNC_CREATE,
        //   (_, categoryId) => {
        //     return [true, object.id === categoryId];
        //   },
        //   null
        // );

        label.label = object.name;
      });

      this._list_view.model = selection;
      this._list_view.factory = factory;
    };

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
