import Handlebars from 'handlebars';
import { readFileSync, writeFileSync } from 'fs';

type CapabilityDescriptor = {
  name: string;
  properties: PropertyDescriptor[];
  capabilityModelClassName?: string
}

type PropertyDescriptor = {
  name: string;
  type: 'boolean' | 'number';
  isWriteable: boolean;
  eventName: string;
}

const toSnakeCase = (x: string) => x.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`).replace(/^_/, '');
const toPascalUpperCase = (x: string) => x.replace(/([A-Z])/g, '_$1').slice(1).toUpperCase();

const capabilities = (require('../capabilities.json') as CapabilityDescriptor[]).map(({ name, properties, capabilityModelClassName = null }) => {
  const moduleName = `${toSnakeCase(name)}.gen`;
  const capabilityEnumName = toPascalUpperCase(name);

  return {
    moduleName,
    className: `${capabilityModelClassName || name}Capability`,
    capabilityName: name,
    capabilityEnumName,
    properties: properties.map(x => {
      return {
        propertyName: x.name,
        propertyEnumName: toPascalUpperCase(x.name),
        isBoolean: x.type === 'boolean',
        isWriteable: x.isWriteable,
        eventType: x.type === 'boolean' ? 'BooleanEvent' : 'NumericEvent',
        fieldName: x.eventName,
      }
    })
  };
});

function generateCapabilityModels() {
  const template = Handlebars.compile(readFileSync('./codegen/templates/capabilities.ts.hbs', 'utf-8'));
  const filePath = `../models/capabilities/capabilities.gen.ts`;
  const providers = capabilities.filter(x => x.properties.some(x => x.isWriteable));

  writeFileSync(`${__dirname}/${filePath}`, template({ capabilities, providers }));

  console.log(`Wrote ${filePath}`);
}

generateCapabilityModels();