import { s as styles_default, c as classRenderer_v3_unified_default, a as classDiagram_default, C as ClassDB } from "./chunk-B4BG7PRW-De2_UYqJ.js";
import { _ as __name } from "./mermaid.core-Tg3ELGg5.js";
import "./index-BqXbE_XA.js";
import "./chunk-FMBD7UC4-Dh1ZPy9g.js";
import "./chunk-55IACEB6-qB94bVmv.js";
import "./chunk-QN33PNHL-C7RCNUlz.js";
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
