import { s as styles_default, c as classRenderer_v3_unified_default, a as classDiagram_default, C as ClassDB } from "./chunk-B4BG7PRW-DpKSua9-.js";
import { _ as __name } from "./mermaid.core-CrWR-dSn.js";
import "./index-C5PVMVYg.js";
import "./chunk-FMBD7UC4-DMNqt4gl.js";
import "./chunk-55IACEB6-CZ8byIIA.js";
import "./chunk-QN33PNHL-D10A7Mx7.js";
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
