import { s as styles_default, c as classRenderer_v3_unified_default, a as classDiagram_default, C as ClassDB } from "./chunk-B4BG7PRW-DAsyiBl3.js";
import { _ as __name } from "./mermaid.core-DsTEWSdM.js";
import "./index-b-9KRjub.js";
import "./chunk-FMBD7UC4-4Z6-Z4jp.js";
import "./chunk-55IACEB6-BTXb-GWW.js";
import "./chunk-QN33PNHL-Bax8lECv.js";
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
