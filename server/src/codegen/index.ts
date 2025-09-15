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

const capabilities = (require('../capabilities.json') as CapabilityDescriptor[]).map(({ name, properties, capabilityModelClassName = null }) => {
  const moduleName = `${name.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`).replace(/^_/, '')}.gen`;
  const capabilityEnumName = name.replace(/([A-Z])/g, '_$1').slice(1).toUpperCase();

  return {
    moduleName,
    className: `${capabilityModelClassName || name}Capability`,
    capabilityName: `${name}Capability`,
    capabilityEnumName,
    properties: properties.map(x => {
      return {
        propertyName: x.name,
        isBoolean: x.type === 'boolean',
        isWriteable: x.isWriteable,
        eventName: x.eventName,
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