import { s as styles_default, b as stateRenderer_v3_unified_default, a as stateDiagram_default, S as StateDB } from "./chunk-DI55MBZ5-BXbJ4P_r.js";
import { _ as __name } from "./mermaid.core-CrWR-dSn.js";
import "./index-C5PVMVYg.js";
import "./chunk-55IACEB6-CZ8byIIA.js";
import "./chunk-QN33PNHL-D10A7Mx7.js";
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
