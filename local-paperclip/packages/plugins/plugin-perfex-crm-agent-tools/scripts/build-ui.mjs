import esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["src/ui/index.tsx"],
  bundle: true,
  format: "esm",
  sourcemap: true,
  outfile: "dist/ui/index.js",
  platform: "browser",
  jsx: "automatic",
  external: ["react", "react-dom", "@paperclipai/plugin-sdk/ui"],
});
