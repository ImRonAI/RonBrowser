import { s as styles_default, c as classRenderer_v3_unified_default, a as classDiagram_default, C as ClassDB } from "./chunk-B4BG7PRW-ZAIyw5vq.js";
import { _ as __name } from "./mermaid.core-ByiRMR7S.js";
import "./index-BTWOgG65.js";
import "./chunk-FMBD7UC4-AJo1fXoM.js";
import "./chunk-55IACEB6-CKNUKdU0.js";
import "./chunk-QN33PNHL-Ufne8wgP.js";
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
