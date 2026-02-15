import { s as styles_default, b as stateRenderer_v3_unified_default, a as stateDiagram_default, S as StateDB } from "./chunk-DI55MBZ5-Czw8g508.js";
import { _ as __name } from "./mermaid.core-Tg3ELGg5.js";
import "./index-BqXbE_XA.js";
import "./chunk-55IACEB6-qB94bVmv.js";
import "./chunk-QN33PNHL-C7RCNUlz.js";
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
