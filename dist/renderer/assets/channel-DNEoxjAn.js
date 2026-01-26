import { ao as Utils, ap as Color } from "./mermaid.core-6lU2e1oE.js";
const channel = (color, channel2) => {
  return Utils.lang.round(Color.parse(color)[channel2]);
};
export {
  channel as c
};
