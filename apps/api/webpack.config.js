module.exports = (options) => {
  return {
    ...options,
    externals: [
      function ({ request }, callback) {
        // Bundle @lavidz/* workspace packages — they're TypeScript source files
        // resolved via tsconfig paths, so they must be inlined into the bundle.
        if (/^@lavidz\//.test(request)) {
          return callback()
        }
        // Externalize all other bare package names (node_modules)
        if (!/^[./]/.test(request)) {
          return callback(null, `commonjs ${request}`)
        }
        // Let webpack handle relative imports normally
        callback()
      },
    ],
  }
}
