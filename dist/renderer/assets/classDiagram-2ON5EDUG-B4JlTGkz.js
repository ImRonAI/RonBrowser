import { s as styles_default, c as classRenderer_v3_unified_default, a as classDiagram_default, C as ClassDB } from "./chunk-B4BG7PRW-B6lYuAZc.js";
import { _ as __name } from "./mermaid.core-kR3KIpo7.js";
import "./index-C82NTjRQ.js";
import "./chunk-FMBD7UC4-BdLwH6NM.js";
import "./chunk-55IACEB6-CL5XMLCH.js";
import "./chunk-QN33PNHL-DGdOlpYW.js";
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
