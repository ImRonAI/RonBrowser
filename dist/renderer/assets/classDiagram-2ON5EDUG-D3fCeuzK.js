import { s as styles_default, c as classRenderer_v3_unified_default, a as classDiagram_default, C as ClassDB } from "./chunk-B4BG7PRW-CF4lOuUL.js";
import { _ as __name } from "./mermaid.core-ZYR0PAy0.js";
import "./index-Djmc3VNA.js";
import "./chunk-FMBD7UC4-Dfbb4uDG.js";
import "./chunk-55IACEB6-BSg_VkJM.js";
import "./chunk-QN33PNHL-GMO7PSLe.js";
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
