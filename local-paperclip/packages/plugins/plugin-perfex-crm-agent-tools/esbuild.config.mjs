import { createPluginBundlerPresets } from "@paperclipai/plugin-sdk/bundlers";

const { esbuild } = createPluginBundlerPresets({
  packageDir: import.meta.dirname,
});

export default esbuild;
