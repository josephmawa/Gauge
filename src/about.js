import Adw from "gi://Adw?version=1";
import Gtk from "gi://Gtk";

const GITHUB_URL = "https://github.com/josephmawa/Gauge";

const aboutParams = {
  application_name: "Gauge",
  developer_name: "Joseph Mawa",
  application_icon: pkg.name,
  version: pkg.version,
  license_type: Gtk.License.LGPL_3_0,
  developers: ["Joseph Mawa"],
  artists: ["Joseph Mawa"],
  translator_credits: _("translator-credits"),
  copyright: "© 2025 Joseph Mawa",
  website: GITHUB_URL,
  issue_url: GITHUB_URL + "/issues",
  support_url: GITHUB_URL + "/issues",
};

export const AboutDialog = () => {
  return new Adw.AboutDialog(aboutParams);
};
