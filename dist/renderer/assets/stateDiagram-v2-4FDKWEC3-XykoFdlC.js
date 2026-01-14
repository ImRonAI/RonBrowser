import { s as styles_default, b as stateRenderer_v3_unified_default, a as stateDiagram_default, S as StateDB } from "./chunk-DI55MBZ5-Bg2O9kWh.js";
import { _ as __name } from "./mermaid.core-MF7qeLt6.js";
import "./index-uDEgB-Sn.js";
import "./chunk-55IACEB6-V2SYvnze.js";
import "./chunk-QN33PNHL-BvgH57SQ.js";
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
