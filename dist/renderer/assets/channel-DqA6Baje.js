import { ao as Utils, ap as Color } from "./mermaid.core-C3k6-g6W.js";
const channel = (color, channel2) => {
  return Utils.lang.round(Color.parse(color)[channel2]);
};
export {
  channel as c
};
