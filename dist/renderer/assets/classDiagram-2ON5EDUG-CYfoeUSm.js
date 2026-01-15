import { s as styles_default, c as classRenderer_v3_unified_default, a as classDiagram_default, C as ClassDB } from "./chunk-B4BG7PRW-CpfVHrrB.js";
import { _ as __name } from "./mermaid.core-Be0A2Lsv.js";
import "./index-HAgQpx63.js";
import "./chunk-FMBD7UC4-eT7Rs5Kj.js";
import "./chunk-55IACEB6-Eh0RNeyX.js";
import "./chunk-QN33PNHL-BkY3rt7i.js";
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
