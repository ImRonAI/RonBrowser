import { s as styles_default, b as stateRenderer_v3_unified_default, a as stateDiagram_default, S as StateDB } from "./chunk-DI55MBZ5-DPCiZmGH.js";
import { _ as __name } from "./mermaid.core-CtINN4Vs.js";
import "./index-O7mIfntf.js";
import "./chunk-55IACEB6-BDM_d-Zu.js";
import "./chunk-QN33PNHL-C5QAqju9.js";
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
