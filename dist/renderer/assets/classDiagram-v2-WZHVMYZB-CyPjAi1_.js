import { s as styles_default, c as classRenderer_v3_unified_default, a as classDiagram_default, C as ClassDB } from "./chunk-B4BG7PRW-pJtPScFK.js";
import { _ as __name } from "./mermaid.core-CtINN4Vs.js";
import "./index-O7mIfntf.js";
import "./chunk-FMBD7UC4-Bp6nREG5.js";
import "./chunk-55IACEB6-BDM_d-Zu.js";
import "./chunk-QN33PNHL-C5QAqju9.js";
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
