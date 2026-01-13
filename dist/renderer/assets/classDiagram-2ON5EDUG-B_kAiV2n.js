import { s as styles_default, c as classRenderer_v3_unified_default, a as classDiagram_default, C as ClassDB } from "./chunk-B4BG7PRW-8_VUkC94.js";
import { _ as __name } from "./mermaid.core-fJR1Yw-g.js";
import "./index-ieLJL9KM.js";
import "./chunk-FMBD7UC4-ByEEc58h.js";
import "./chunk-55IACEB6-Ba2rmDHT.js";
import "./chunk-QN33PNHL-D4e3hYVG.js";
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
