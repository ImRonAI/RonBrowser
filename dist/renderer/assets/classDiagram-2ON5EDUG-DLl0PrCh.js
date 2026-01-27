import { s as styles_default, c as classRenderer_v3_unified_default, a as classDiagram_default, C as ClassDB } from "./chunk-B4BG7PRW-_M5c7krg.js";
import { _ as __name } from "./mermaid.core-jX_aMB8H.js";
import "./index-9nwLSXz4.js";
import "./chunk-FMBD7UC4-BI9ypQvx.js";
import "./chunk-55IACEB6-CeYypnLQ.js";
import "./chunk-QN33PNHL-SO6n9-pE.js";
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
