// Fallback declaration for tsc CLI.
// The typescript-plugin-css-modules plugin provides IDE autocomplete and type checking.
declare module '*.module.css' {
  const classNames: { readonly [className: string]: string };
  export = classNames;
}
