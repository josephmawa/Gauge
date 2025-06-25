import Gio from "gi://Gio";

export const settings = Gio.Settings.new(pkg.name);
export const regexes = {
  validEntry: /^[+-]?(\d+(\.\d*)?(e[+-]?\d*)?|\.\d+(e[+-]?\d*)?)?$/,
  validNumber: /^-?\d*\.?\d+(?:[eE][+-]?\d+)?$/,
  validDigit: /[-+eE0-9\.]/,
};
