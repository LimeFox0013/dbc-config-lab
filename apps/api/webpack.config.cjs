const { join } = require('path')
const CopyPlugin = require('copy-webpack-plugin')

/** Workspace packages ship TypeScript source, so they are bundled; every npm package stays external. */
const BUNDLED = /^@(dbc-config-lab|lf)\//

// Plain webpack (no Nx plugin), so the build needs no Nx project graph and runs
// the same in the sandbox, a worktree and the public repo.
module.exports = (_env, argv) => ({
  target: 'node',
  mode:
    argv.mode ??
    (process.env.NODE_ENV === 'production' ? 'production' : 'development'),
  entry: './src/main.ts',
  output: { path: join(__dirname, 'dist'), filename: 'main.js', clean: true },
  devtool: 'source-map',
  resolve: {
    extensions: ['.ts', '.js', '.json'],
    // Libraries written for Node's ESM resolution import their own files as `.js`.
    extensionAlias: { '.js': ['.ts', '.js'] },
  },
  externals: [
    ({ request }, callback) =>
      !request || /^[./]/.test(request) || BUNDLED.test(request)
        ? callback()
        : callback(null, `commonjs ${request}`),
  ],
  externalsPresets: { node: true },
  module: {
    rules: [
      {
        test: /\.ts$/,
        loader: 'ts-loader',
        options: {
          transpileOnly: true,
          configFile: join(__dirname, 'tsconfig.app.json'),
        },
      },
    ],
  },
  plugins: [
    // Migrations run at startup (DatabaseService) from dist/drizzle.
    new CopyPlugin({ patterns: [{ from: 'drizzle', to: 'drizzle' }] }),
  ],
  optimization: { minimize: false },
})
