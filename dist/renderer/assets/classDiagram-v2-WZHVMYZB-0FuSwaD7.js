import { s as styles_default, c as classRenderer_v3_unified_default, a as classDiagram_default, C as ClassDB } from "./chunk-B4BG7PRW-STo3sVvE.js";
import { _ as __name } from "./mermaid.core-CPrsVit4.js";
import "./index-DGawAcrk.js";
import "./chunk-FMBD7UC4-D_kUOaTB.js";
import "./chunk-55IACEB6-BGMsF7Ev.js";
import "./chunk-QN33PNHL-Ce17-H3B.js";
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
