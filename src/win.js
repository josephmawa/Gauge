import Adw from "gi://Adw";
import Gtk from "gi://Gtk";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GObject from "gi://GObject";

import {
  regexes,
  settings,
  CursorState,
  processUnits,
  getCustomFilter,
} from "./util.js";
import { units } from "./units.js";
import { Unit } from "./gobjects.js";

/**
 * Big number library for large number manipulation and
 * formatting.
 */
import "./big-number.js";

export const GaugeWindow = GObject.registerClass(
  {
    GTypeName: "GaugeWindow",
    Template: getResourceURI("win.ui"),
    Properties: {
      unit_id: GObject.ParamSpec.string(
        "unit_id",
        "unitId",
        "Selected Unit ID",
        GObject.ParamFlags.READWRITE,
        "meter"
      ),
    },
    InternalChildren: [
      "list_view",
      "search_bar",
      "split_view",
      "input_entry",
      "output_entry",
      "input_dropdown",
      "output_dropdown",
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
      this.updatePrecision();
      this.createDropdownModels();
      this.createColorSchemeAction();
    }

    handleSearch(searchEntry) {
      /**
       * FIXME:
       * Searching on every keypress is inefficient. There is need
       * to debounce this method.
       */
      const searchText = searchEntry.text.trim().toLocaleLowerCase();
      this.customFilter.set_filter_func(getCustomFilter(searchText));
    }

    activateUnit(listView, position) {
      const item = listView.model.selected_item.item;
      if (!item.children.length) {
        this.unit_id = item.id;
      }
    }

    createSidebar = () => {
      if (!this.processedUnits) {
        this.processedUnits = processUnits(units);
      }
      const store = Gio.ListStore.new(Unit);

      for (const unit of this.processedUnits) {
        store.append(new Unit(unit));
      }

      this.customFilter = Gtk.CustomFilter.new(null);
      const filter = Gtk.FilterListModel.new(store, this.customFilter);

      const tree = Gtk.TreeListModel.new(filter, false, false, (item) => {
        if (!item.children.length) return null;

        const nestedStore = Gio.ListStore.new(Unit);
        const nestedModel = Gtk.FilterListModel.new(
          nestedStore,
          this.customFilter
        );

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

        const hBoxInnerOne = new Gtk.Box({
          orientation: Gtk.Orientation.HORIZONTAL,
          halign: Gtk.Align.START,
          hexpand: true,
        });
        const hBoxInnerTwo = new Gtk.Box({
          orientation: Gtk.Orientation.HORIZONTAL,
          halign: Gtk.Align.END,
          hexpand: true,
        });

        const label = new Gtk.Label();
        const icon = new Gtk.Image({
          icon_name: "gauge-object-select-symbolic",
          visible: false,
          pixel_size: 12,
        });

        hBoxInnerOne.append(label);
        hBoxInnerTwo.append(icon);

        hBox.append(hBoxInnerOne);
        hBox.append(hBoxInnerTwo);

        listItem.child = new Gtk.TreeExpander({ child: hBox });
      });

      factory.connect("bind", (_, listItem) => {
        const listRow = listItem.item;
        const expander = listItem.child;

        expander.list_row = listRow;

        const hBox = expander.child;
        const label = hBox?.get_first_child()?.get_first_child();
        const image = hBox?.get_last_child()?.get_first_child();
        const object = listRow.item;

        /** Make images on the non-root elements visible if selected */
        if (!object.children.length) {
          this.bind_property_full(
            "unit_id",
            image,
            "visible",
            GObject.BindingFlags.DEFAULT || GObject.BindingFlags.SYNC_CREATE,
            (_, unitId) => {
              return [true, object.id === unitId];
            },
            null
          );
        }

        label.label = object.name;
      });

      this._list_view.model = selection;
      this._list_view.factory = factory;
    };

    createDropdownModels = () => {
      if (!this.processedUnits) {
        this.processedUnits = processUnits(units);
      }
      const inputModel = Gio.ListStore.new(Unit);
      const outputModel = Gio.ListStore.new(Unit);

      const defaultUnit = this.processedUnits.find((unit) => {
        return unit.id === "meter";
      });

      for (const unit of defaultUnit.children) {
        inputModel.append(new Unit(unit));
        outputModel.append(new Unit(unit));
      }

      const inputExpression = Gtk.PropertyExpression.new(Unit, null, "name");
      const outputExpression = Gtk.PropertyExpression.new(Unit, null, "name");

      this._input_dropdown.expression = inputExpression;
      this._output_dropdown.expression = outputExpression;

      this._input_dropdown.model = inputModel;
      this._output_dropdown.model = outputModel;
    };

    connectHandlers = () => {
      const initialCursorState = { position: -1, update: false };
      const inputEntrycursorState = new CursorState(initialCursorState);
      if (!this.convertUnitDebounced) {
        this.convertUnitDebounced = this.debounce(this.convertUnit, 300);
      }
      /**
       * NOTE:
       * You can't connect insert-text event to Gtk.Entry directly.
       * Read more about it in the following reference docs:
       * • https://gitlab.gnome.org/GNOME/gtk/-/issues/4315
       * • https://docs.gtk.org/gtk4/iface.Editable.html#implementing-gtkeditable
       */
      this._input_entry.get_delegate().connect("insert-text", (...args) => {
        this.insertText(...args, inputEntrycursorState);
      });

      this._input_entry.connect("changed", (entry) => {
        this.setCursorPosition(entry, inputEntrycursorState);
        this.convertUnitDebounced();
      });
    };

    convertUnit = () => {
      const input = this._input_entry.text;
      if (!input.trim()) {
        this._output_entry.text = "";
        return;
      }

      if (!regexes.validNumber.test(input)) {
        return;
      }

      const a = new BigNumber(input);
      const b = new BigNumber("1000");
      const c = new BigNumber("0.01");
      const conversion = a.times(b).div(c).toString();

      this._output_entry.text = conversion;
    };

    createActions = () => {
      const search = Gio.SimpleAction.new("search", null);
      search.connect("activate", () => {
        this._search_bar.search_mode_enabled =
          !this._search_bar.search_mode_enabled;

        const searchModeEnabled = this._search_bar.search_mode_enabled;
        const tree = this._list_view.model.model;
        const rootModel = tree.model;

        /**
         * This will expand all the root-level widgets when search
         * mode is enabled and closes them when search mode is disabled.
         *
         * There are two methdos for retrieving rows; tree.get_child_row
         * and tree.get_row. I'm not sure I understand the difference
         * between the two. However, in this case tree.get_child_row retrieves
         * the expandable rows.
         *
         * To loop over the topmost row widgets, retrieve the number of
         * items from the root model, the model passed to the Gtk.TreeListModel
         */
        for (let i = 0; i < rootModel.n_items; i++) {
          const listRow = tree.get_child_row(i);
          if (!listRow?.expandable) continue;

          if (searchModeEnabled) {
            listRow.expanded = true;
          } else {
            listRow.expanded = false;
          }
        }
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

      settings.connect("changed::precision", this.updatePrecision);
    };

    updatePrecision = () => {
      BigNumber.config({ DECIMAL_PLACES: settings.get_int("precision") });
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
