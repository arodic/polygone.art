import path from 'path';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import { terser } from "rollup-plugin-terser";

const externals = [];

function makeBundleTarget(src, target) {
  const _externals = [...externals];
  externals.push(path.resolve(src));
  return {
    input: src,
    plugins: [
      nodeResolve(),
      terser({
        keep_classnames: true,
        keep_fnames: true,
      })
    ],
    treeshake: true,
    output: [{
      inlineDynamicImports: true,
      format: 'es',
      file: target,
      indent: '  '
    }],
    external: _externals,
    onwarn: (warning, warn) => {
      if (warning.code === 'THIS_IS_UNDEFINED') return;
      warn(warning);
    }
  };
}

export default [
  makeBundleTarget('build/poly-app.js', 'bundle/poly-app.js'),
];
