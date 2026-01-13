import { s as styles_default, c as classRenderer_v3_unified_default, a as classDiagram_default, C as ClassDB } from "./chunk-B4BG7PRW-BovHMzUC.js";
import { _ as __name } from "./mermaid.core-BzrJox_m.js";
import "./index-Bv2NuZOj.js";
import "./chunk-FMBD7UC4-Ds7Ge5Zg.js";
import "./chunk-55IACEB6-58nViBGo.js";
import "./chunk-QN33PNHL-CNIVNjV4.js";
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
