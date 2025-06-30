import Gio from "gi://Gio";

export const settings = Gio.Settings.new(pkg.name);
export const regexes = {
  validEntry: /^[+-]?(\d+(\.\d*)?(e[+-]?\d*)?|\.\d+(e[+-]?\d*)?)?$/,
  validNumber: /^-?\d*\.?\d+(?:[eE][+-]?\d+)?$/,
  validDigit: /[-+eE0-9\.]/,
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

export function processUnits(units) {
  const processedUnits = [];
  for (const unit of units) {
    const object = {
      id: unit.idBaseUnit,
      name: unit.name,
      children: [],
    };
    for (const { id, label } of unit.units) {
      object.children.push({
        id,
        name:label,
        children: [],
      });
    }
    processedUnits.push(object);
  }
  return processedUnits;
}
