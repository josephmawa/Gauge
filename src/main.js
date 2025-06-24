import { GaugeApplication } from "./app.js";

export function main(argv) {
  const application = new GaugeApplication();
  return application.runAsync(argv);
}
