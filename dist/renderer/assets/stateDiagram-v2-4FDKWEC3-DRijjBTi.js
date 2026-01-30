import { s as styles_default, b as stateRenderer_v3_unified_default, a as stateDiagram_default, S as StateDB } from "./chunk-DI55MBZ5-CXa9uDRc.js";
import { _ as __name } from "./mermaid.core-kR3KIpo7.js";
import "./index-C82NTjRQ.js";
import "./chunk-55IACEB6-CL5XMLCH.js";
import "./chunk-QN33PNHL-DGdOlpYW.js";
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
