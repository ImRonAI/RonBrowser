import { s as styles_default, b as stateRenderer_v3_unified_default, a as stateDiagram_default, S as StateDB } from "./chunk-DI55MBZ5-CMdgB82J.js";
import { _ as __name } from "./mermaid.core-jX_aMB8H.js";
import "./index-9nwLSXz4.js";
import "./chunk-55IACEB6-CeYypnLQ.js";
import "./chunk-QN33PNHL-SO6n9-pE.js";
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
