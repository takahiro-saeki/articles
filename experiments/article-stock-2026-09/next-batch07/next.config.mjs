import fs from 'node:fs';
export default {
  cacheComponents: false,
  reactCompiler: false,
  poweredByHeader: false,
  webpack(config, { isServer }) {
    if (!isServer) config.plugins.push({
      apply(compiler) {
        compiler.hooks.done.tap('ArticleModuleEvidence', stats => {
          fs.writeFileSync('client-modules.json', JSON.stringify(stats.toJson({
            all: false, modules: true, nestedModules: true, chunks: true, chunkModules: true,
          })));
        },
        );
      },
    });
    return config;
  },
};
