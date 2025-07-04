import GObject from "gi://GObject";

export const Symbols = GObject.registerClass(
  {
    GTypeName: "Symbols",
    Properties: {
      full: GObject.ParamSpec.string(
        "full",
        "Full",
        "Full form of unit symbol",
        GObject.ParamFlags.READWRITE,
        ""
      ),
      short: GObject.ParamSpec.string(
        "short",
        "Short",
        "Short form of unit symbol",
        GObject.ParamFlags.READWRITE,
        ""
      ),
      plural: GObject.ParamSpec.string(
        "plural",
        "Plural",
        "Plural form of unit symbol",
        GObject.ParamFlags.READWRITE,
        ""
      ),
    },
  },
  class Symbols extends GObject.Object {
    constructor({ full, short, plural } = {}) {
      super();
      this.full = full ?? "";
      this.short = short ?? "";
      this.plural = plural ?? "";
    }
  }
);

export const Base = GObject.registerClass(
  {
    GTypeName: "Base",
    Properties: {
      id_base_unit: GObject.ParamSpec.string(
        "id_base_unit",
        "idBaseUnit",
        "Base unit Id",
        GObject.ParamFlags.READWRITE,
        ""
      ),
      label: GObject.ParamSpec.string(
        "label",
        "Label",
        "Unit label",
        GObject.ParamFlags.READWRITE,
        ""
      ),
    },
  },
  class Base extends GObject.Object {
    constructor() {
      super();
    }
  }
);

export const Group = GObject.registerClass(
  {
    GTypeName: "Group",
    Properties: {
      units: GObject.ParamSpec.jsobject(
        "units",
        "Units",
        "Units in this unit group",
        GObject.ParamFlags.READWRITE,
        []
      ),
    },
  },
  class Group extends Base {
    constructor({ idBaseUnit, label, units } = {}) {
      super();
      this.idBaseUnit = idBaseUnit ?? "";
      this.label = label ?? "";
      this.units = units ?? [];
    }
  }
);

export const Unit = GObject.registerClass(
  {
    GTypeName: "Unit",
    Properties: {
      id: GObject.ParamSpec.string(
        "id",
        "Id",
        "Unit Id",
        GObject.ParamFlags.READWRITE,
        ""
      ),
      to_base_factor: GObject.ParamSpec.string(
        "to_base_factor",
        "toBaseFactor",
        "Base unit conversion factor",
        GObject.ParamFlags.READWRITE,
        ""
      ),
      symbols: GObject.ParamSpec.object(
        "symbols",
        "Symbols",
        "Unit symbols",
        GObject.ParamFlags.READWRITE,
        new Symbols()
      ),
    },
  },
  class Unit extends Base {
    constructor({ id, label, toBaseFactor, idBaseUnit, symbols } = {}) {
      super();
      this.id = id;
      this.label = label;
      this.toBaseFactor = toBaseFactor;
      this.idBaseUnit = idBaseUnit;
      this.symbols = new Symbols(symbols);
    }
  }
);
