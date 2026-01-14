import { s as styles_default, c as classRenderer_v3_unified_default, a as classDiagram_default, C as ClassDB } from "./chunk-B4BG7PRW-BZb9Iea3.js";
import { _ as __name } from "./mermaid.core-C3k6-g6W.js";
import "./index-CWrZUnfJ.js";
import "./chunk-FMBD7UC4-DQGElhyu.js";
import "./chunk-55IACEB6-DYqlssw9.js";
import "./chunk-QN33PNHL-CeVAWd5W.js";
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
