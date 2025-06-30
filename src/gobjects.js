import GObject from "gi://GObject";

export const Unit = GObject.registerClass(
  {
    GTypeName: "Unit",
    Properties: {
      id: GObject.ParamSpec.string(
        "id",
        "Id",
        "Property Id",
        GObject.ParamFlags.READWRITE,
        ""
      ),
      name: GObject.ParamSpec.string(
        "name",
        "Name",
        "Unit name",
        GObject.ParamFlags.READWRITE,
        ""
      ),
      children: GObject.ParamSpec.jsobject(
        "children",
        "categoryChildren",
        "Category children",
        GObject.ParamFlags.READWRITE,
        []
      ),
    },
  },
  class Unit extends GObject.Object {
    constructor({ id, name, children }) {
      super();
      this.id = id;
      this.name = name;
      this.children = children;
    }
  }
);