import { createPluginBundlerPresets } from "@paperclipai/plugin-sdk/bundlers";

const { rollup } = createPluginBundlerPresets({
  packageDir: import.meta.dirname,
});

export default rollup;
