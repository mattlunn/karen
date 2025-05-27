export type PropertyDecoratorOptions = {
  writeable?: boolean;
  dbName: string;
}

export { numericProperty, numericGetter, numericSetter } from './numeric_property';
export { booleanProperty } from './boolean_property';