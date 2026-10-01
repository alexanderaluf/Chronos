// Lets TypeScript resolve CSS side-effect imports (e.g. `import "../../global.css"`).
// Metro + NativeWind handle the actual CSS processing.
declare module "*.css";
