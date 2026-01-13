import { ao as Utils, ap as Color } from "./mermaid.core-fJR1Yw-g.js";
const channel = (color, channel2) => {
  return Utils.lang.round(Color.parse(color)[channel2]);
};
export {
  channel as c
};
