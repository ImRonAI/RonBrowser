import { s as styles_default, b as stateRenderer_v3_unified_default, a as stateDiagram_default, S as StateDB } from "./chunk-DI55MBZ5-h9K8i9gx.js";
import { _ as __name } from "./mermaid.core-DsTEWSdM.js";
import "./index-b-9KRjub.js";
import "./chunk-55IACEB6-BTXb-GWW.js";
import "./chunk-QN33PNHL-Bax8lECv.js";
var diagram = {
  parser: stateDiagram_default,
  get db() {
    return new StateDB(2);
  },
  renderer: stateRenderer_v3_unified_default,
  styles: styles_default,
  init: /* @__PURE__ */ __name((cnf) => {
    if (!cnf.state) {
      cnf.state = {};
    }
    cnf.state.arrowMarkerAbsolute = cnf.arrowMarkerAbsolute;
  }, "init")
};
export {
  diagram
};
