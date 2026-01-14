import { s as styles_default, c as classRenderer_v3_unified_default, a as classDiagram_default, C as ClassDB } from "./chunk-B4BG7PRW-DK1cmm7n.js";
import { _ as __name } from "./mermaid.core-BnkDIP44.js";
import "./index-DQDHufSd.js";
import "./chunk-FMBD7UC4-Bi369zoC.js";
import "./chunk-55IACEB6-CaPxB3N4.js";
import "./chunk-QN33PNHL-Ckj6vR3W.js";
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
