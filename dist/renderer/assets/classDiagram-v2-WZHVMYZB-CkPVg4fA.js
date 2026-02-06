import { s as styles_default, c as classRenderer_v3_unified_default, a as classDiagram_default, C as ClassDB } from "./chunk-B4BG7PRW-CyO65L3E.js";
import { _ as __name } from "./mermaid.core-Co1P_YqB.js";
import "./index-DfSRPnTF.js";
import "./chunk-FMBD7UC4-B4lKSny3.js";
import "./chunk-55IACEB6-pY14BwfJ.js";
import "./chunk-QN33PNHL-BhFS21g7.js";
var diagram = {
  parser: classDiagram_default,
  get db() {
    return new ClassDB();
  },
  renderer: classRenderer_v3_unified_default,
  styles: styles_default,
  init: /* @__PURE__ */ __name((cnf) => {
    if (!cnf.class) {
      cnf.class = {};
    }
    cnf.class.arrowMarkerAbsolute = cnf.arrowMarkerAbsolute;
  }, "init")
};
export {
  diagram
};
