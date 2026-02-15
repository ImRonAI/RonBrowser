import { s as styles_default, c as classRenderer_v3_unified_default, a as classDiagram_default, C as ClassDB } from "./chunk-B4BG7PRW-DM5PfU6s.js";
import { _ as __name } from "./mermaid.core-CYEdxk2z.js";
import "./index-DNrTz991.js";
import "./chunk-FMBD7UC4-BuGBydsq.js";
import "./chunk-55IACEB6-Ba9mltq1.js";
import "./chunk-QN33PNHL-CdQ9gzJ4.js";
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
