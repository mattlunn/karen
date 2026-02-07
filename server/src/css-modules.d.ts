// Fallback declaration for tsc CLI.
// The typescript-plugin-css-modules provides IDE autocomplete and type checking.
declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}
