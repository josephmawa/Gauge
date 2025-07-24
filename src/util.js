import Gio from "gi://Gio";

export const settings = Gio.Settings.new(pkg.name);
export const regexes = {
  validEntry: /^[+-]?(\d+(\.\d*)?(e[+-]?\d*)?|\.\d+(e[+-]?\d*)?)?$/,
  validNumber: /^-?\d*\.?\d+(?:[eE][+-]?\d+)?$/,
  validDigit: /[-+eE0-9\.]/,
};
export const base = {
  binary: 2,
  octal: 8,
  decimal: 10,
  hexadecimal: 16,
};

export class CursorState {
  #position = -1;
  #update = false;
  constructor({ position, update } = {}) {
    this.#position = position ?? -1;
    this.#update = update ?? false;
  }

  set position(position) {
    this.#position = position;
  }

  get position() {
    return this.#position;
  }

  set update(update) {
    this.#update = update;
  }

  get update() {
    return this.#update;
  }
}

export function processUnitGroups(unitGroups) {
  return unitGroups.map((group) => {
    return {
      ...group,
      units: group.units.map((unit) => {
        return {
          ...unit,
          symbols: { ...unit.symbols },
          idBaseUnit: group.idBaseUnit,
        };
      }),
    };
  });
}

export function getCustomFilter(string) {
  return (item) => {
    if (item.units) return true;
    return item.label.toLocaleLowerCase().includes(string);
  };
}
