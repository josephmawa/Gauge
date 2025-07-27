import Adw from "gi://Adw";
import Gdk from "gi://Gdk";
import Gtk from "gi://Gtk";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import Pango from "gi://Pango";
import GObject from "gi://GObject";

import {
  base,
  regexes,
  settings,
  CursorState,
  getCustomFilter,
  processUnitGroups,
} from "./util.js";
import { units } from "./units.js";
import { Unit, Group } from "./gobjects.js";

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
      "toast_overlay",
      "input_dropdown",
      "output_dropdown",
    ],
  },
  class GaugeWindow extends Adw.ApplicationWindow {
    constructor(application) {
      super({ application });

      this.loadStyles();
      this.createToast();
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
       * Searching on every keypress is inefficient. Need
       * to debounce this method.
       */
      const searchText = searchEntry.text.trim().toLocaleLowerCase();
      this.customFilter.set_filter_func(getCustomFilter(searchText));
    }

    activateUnit(listView, position) {
      const item = listView.model.selected_item.item;
      if (item instanceof Unit) {
        this.updateSelectedItem(item);
        this.unit_id = item.id;
        return;
      }
      this.updateDropdowns(item);
      this.unit_id = item.units[0]?.id;
    }

    updateSelectedItem = (item) => {
      const inputModel = this._input_dropdown.model;
      const outputModel = this._output_dropdown.model;
      if (item.idBaseUnit !== inputModel.get_item(0)?.idBaseUnit) {
        /**
         * User has clicked unit in a different group. Retrieve that
         * group and update dropdowns.
         */
        const model = this._list_view.model.model.model.model;
        for (let i = 0; i < model.n_items; i++) {
          const groupItem = model.get_item(i);
          if (item.idBaseUnit === groupItem.idBaseUnit) {
            this.updateDropdowns(groupItem);
            break;
          }
        }
      }

      if (inputModel.n_items !== outputModel.n_items) {
        throw new Error("Dropdowns must've same items");
      }

      for (let i = 0; i < inputModel.n_items; i++) {
        const inputItem = inputModel.get_item(i);
        const outputItem = outputModel.get_item(i);

        if (inputItem.id === item.id && outputItem.id === item.id) {
          this._input_dropdown.selected = i;
          this._output_dropdown.selected = i;
          break;
        }
      }
    };

    updateDropdowns = (item) => {
      const inputModel = this._input_dropdown.model;
      const outputModel = this._output_dropdown.model;

      /**
       * User clicked a unit group while the selected unit is
       * in the same group.
       */
      if (item.idBaseUnit === inputModel.get_item(0)?.idBaseUnit) {
        return;
      }

      inputModel.remove_all();
      outputModel.remove_all();

      for (const unit of item.units) {
        inputModel.append(new Unit(unit));
        outputModel.append(new Unit(unit));
      }
    };

    createSidebar = () => {
      if (!this.processedUnitGroups) {
        this.processedUnitGroups = processUnitGroups(units);
      }
      const store = Gio.ListStore.new(Group);

      for (const group of this.processedUnitGroups) {
        store.append(new Group(group));
      }

      this.customFilter = Gtk.CustomFilter.new(null);
      const filter = Gtk.FilterListModel.new(store, this.customFilter);

      const tree = Gtk.TreeListModel.new(filter, false, false, (item) => {
        if (item instanceof Unit) return null;

        const nestedStore = Gio.ListStore.new(Unit);
        const nestedModel = Gtk.FilterListModel.new(
          nestedStore,
          this.customFilter
        );

        for (const unit of item.units) {
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
          spacing: 10,
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

        const label = new Gtk.Label({ ellipsize: Pango.EllipsizeMode.END });
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

      factory.connect("bind", (factory, listItem) => {
        const listRow = listItem.item;
        const expander = listItem.child;

        expander.list_row = listRow;

        const hBox = expander.child;
        const label = hBox?.get_first_child()?.get_first_child();
        const image = hBox?.get_last_child()?.get_first_child();
        const item = listRow.item;

        /** Make images on the non-root elements visible if selected */
        if (item instanceof Unit) {
          this.bind_property_full(
            "unit_id",
            image,
            "visible",
            GObject.BindingFlags.DEFAULT || GObject.BindingFlags.SYNC_CREATE,
            (_, unitId) => {
              return [true, item.id === unitId];
            },
            null
          );
        }

        label.label = item.label;
      });

      this._list_view.model = selection;
      this._list_view.factory = factory;
    };

    createDropdownModels = () => {
      if (!this.processedUnitGroups) {
        this.processedUnitGroups = processUnitGroups(units);
      }
      const inputModel = Gio.ListStore.new(Unit);
      const outputModel = Gio.ListStore.new(Unit);

      const defaultUnitGroup = this.processedUnitGroups.find((group) => {
        return group.idBaseUnit === "meter";
      });

      for (const unit of defaultUnitGroup.units) {
        inputModel.append(new Unit(unit));
        outputModel.append(new Unit(unit));
      }

      const inputExpression = Gtk.PropertyExpression.new(Unit, null, "label");
      const outputExpression = Gtk.PropertyExpression.new(Unit, null, "label");

      this._input_dropdown.expression = inputExpression;
      this._output_dropdown.expression = outputExpression;

      this._input_dropdown.model = inputModel;
      this._output_dropdown.model = outputModel;

      this._input_dropdown.connect(
        "notify::selected",
        this.unitSelectedHandler
      );
      this._output_dropdown.connect(
        "notify::selected",
        this.unitSelectedHandler
      );
      this.unitSelectedHandler();
    };

    /**
     * FIXME:
     * This event handler is invoked as many times as there
     * are items in the dropdown when switching unit groups.
     */
    unitSelectedHandler = () => {
      if (!this.convertUnitDebounced) {
        this.convertUnitDebounced = this.debounce(this.convertUnit, 300);
      }
      this.convertUnitDebounced();
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
        if (this._input_entry.css_classes.includes("error")) {
          this._input_entry.remove_css_class("error");
        }

        if (this._output_entry.css_classes.includes("error")) {
          this._output_entry.remove_css_class("error");
        }

        this._output_entry.text = "";
        return;
      }

      const unitId = this._input_dropdown.selected_item.id;
      let validNumRegex = regexes.number.validNumber;

      if (unitId === "binary") {
        validNumRegex = regexes.binary.validNumber;
      } else if (unitId === "octal") {
        validNumRegex = regexes.octal.validNumber;
      } else if (unitId === "hexadecimal") {
        validNumRegex = regexes.hex.validNumber;
      }

      if (!validNumRegex.test(input)) {
        if (!this._input_entry.css_classes.includes("error")) {
          this._input_entry.add_css_class("error");
        }
        if (!this._output_entry.css_classes.includes("error")) {
          this._output_entry.add_css_class("error");
        }
        return;
      }

      if (this._input_entry.css_classes.includes("error")) {
        this._input_entry.remove_css_class("error");
      }

      if (this._output_entry.css_classes.includes("error")) {
        this._output_entry.remove_css_class("error");
      }

      const inputItem = this._input_dropdown.selected_item;
      const outputItem = this._output_dropdown.selected_item;
      if (inputItem.id === outputItem.id) {
        this._output_entry.text = input;
        return;
      }

      const precision = settings.get_int("precision");

      if (inputItem.idBaseUnit === "decimal") {
        /**
         * FIXME:
         * This doesn't round to the required number of decimal places.
         * Bignumber.js uses the decimal places set using config. Looks
         * like there is no built-in method to convert from base 10 and
         * at the same time round to a given number of decimal places in
         * bignumber.js.
         *
         * The number of decimal places set at config is 2 points greater
         * than the precision the user chooses from settings to avoid
         * rounding errors.
         *
         * One possible solution is to change the config and set it back
         * after that.
         *
         * Another possible solution is to write a function that rounds
         * the converted number to the required number of decimal places.
         */
        const inputNum = new BigNumber(input, base[inputItem.id]);
        this._output_entry.text = inputNum.toString(base[outputItem.id]);
        return;
      }

      const a = new BigNumber(input);

      if (inputItem.idBaseUnit === "celsius") {
        let toBaseUnit = a;
        if (inputItem.id === "kelvin") {
          toBaseUnit = a.minus(new BigNumber(273.15));
        }

        if (inputItem.id === "fahrenheit") {
          toBaseUnit = a
            .minus(new BigNumber(32))
            .times(new BigNumber(5).div(new BigNumber(9)));
        }

        let toOutput = toBaseUnit;

        if (outputItem.id === "kelvin") {
          toOutput = toBaseUnit.plus(new BigNumber(273.15));
        }

        if (outputItem.id === "fahrenheit") {
          toOutput = toBaseUnit
            .times(new BigNumber(1.8))
            .plus(new BigNumber(32));
        }

        this._output_entry.text = toOutput.round(precision).toString();
        return;
      }

      const b = new BigNumber(inputItem.toBaseFactor);
      const c = new BigNumber(outputItem.toBaseFactor);

      const conversion = a.times(b).div(c).round(precision).toString();
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

      const switchUnits = Gio.SimpleAction.new("switch-units", null);
      switchUnits.connect("activate", () => {
        const inputModel = this._input_dropdown.model;
        const outputModel = this._output_dropdown.model;

        if (inputModel.n_items !== outputModel.n_items) {
          throw new Error("Dropdowns must've same items");
        }

        const itemInput = this._input_dropdown.selected_item;
        const itemOutput = this._output_dropdown.selected_item;

        if (itemInput.id === itemOutput.id) {
          return;
        }

        const i = this._input_dropdown.selected;
        const j = this._output_dropdown.selected;

        this._input_dropdown.selected = j;
        this._output_dropdown.selected = i;
        this.convertUnit();
      });
      this.add_action(switchUnits);
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
      if (!this.convertUnitDebounced) {
        this.convertUnitDebounced = this.debounce(this.convertUnit, 300);
      }

      BigNumber.config({
        ROUNDING_MODE: BigNumber.ROUND_HALF_CEIL,
        DECIMAL_PLACES: settings.get_int("precision") + 3,
      });
      this.convertUnitDebounced();
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

      const unitId = this._input_dropdown.selected_item.id;
      let validDigitRegex = regexes.number.validDigit;
      let validEntryRegex = regexes.number.validEntry;

      if (unitId === "binary") {
        validDigitRegex = regexes.binary.validDigit;
        validEntryRegex = regexes.binary.validEntry;
      } else if (unitId === "octal") {
        validDigitRegex = regexes.octal.validDigit;
        validEntryRegex = regexes.octal.validEntry;
      } else if (unitId === "hexadecimal") {
        validDigitRegex = regexes.hex.validDigit;
        validEntryRegex = regexes.hex.validEntry;
      }

      if (validDigitRegex.test(text)) {
        /**
         * We only allow these characters: /[-+eE0-9]/.
         * Therefore, the text entry will contain ASCII
         * and the spread syntax will split the string
         * into actual characters.
         */
        const characters = [...editable.text];
        const cursorPosition = editable.get_position();
        characters.splice(cursorPosition, 0, text);

        if (validEntryRegex.test(characters.join(""))) {
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

    entryIconPressHandler(entry, iconPos) {
      if (Gtk.EntryIconPosition.SECONDARY === iconPos) {
        const text = entry.get_text();
        if (!text) return;

        this.copyToClipboard(text);
        this.displayToast(_("Copied value"));
      }
    }

    displayToast = (message) => {
      this.toast.dismiss();
      this.toast.title = message;
      this._toast_overlay.add_toast(this.toast);
    };

    copyToClipboard = (text) => {
      const clipboard = this.display.get_clipboard();
      const contentProvider = Gdk.ContentProvider.new_for_value(text);
      clipboard.set_content(contentProvider);
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
