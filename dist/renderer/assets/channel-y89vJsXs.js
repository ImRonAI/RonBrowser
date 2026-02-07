import { U as Utils, C as Color } from "./mermaid.core-Co1P_YqB.js";
const channel = (color, channel2) => {
  return Utils.lang.round(Color.parse(color)[channel2]);
};
export {
  channel as c
};
