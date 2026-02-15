import { s as styles_default, c as classRenderer_v3_unified_default, a as classDiagram_default, C as ClassDB } from "./chunk-B4BG7PRW-B9nY_aP9.js";
import { _ as __name } from "./mermaid.core-bjaggrNX.js";
import "./index-DZaxnShF.js";
import "./chunk-FMBD7UC4-BO0wMApG.js";
import "./chunk-55IACEB6-C6esQNAh.js";
import "./chunk-QN33PNHL-DteoR-3-.js";
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
