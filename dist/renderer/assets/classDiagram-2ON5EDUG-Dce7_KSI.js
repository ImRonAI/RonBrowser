import { s as styles_default, c as classRenderer_v3_unified_default, a as classDiagram_default, C as ClassDB } from "./chunk-B4BG7PRW-BQzpBIic.js";
import { _ as __name } from "./mermaid.core-6lU2e1oE.js";
import "./index-BSkKA6rm.js";
import "./chunk-FMBD7UC4-8NddzgW9.js";
import "./chunk-55IACEB6-Bg4kQJTb.js";
import "./chunk-QN33PNHL-CPECp3-J.js";
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
