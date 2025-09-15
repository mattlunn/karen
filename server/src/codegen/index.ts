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
  const filePath = `../models/capabilities/${moduleName}.ts`;

  return {
    moduleName,
    filePath,
    className: `${capabilityModelClassName || name}Capability`,
    capabilityName: `${name}Capability`,
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
  const template = Handlebars.compile(readFileSync('./codegen/templates/capability.ts.hbs', 'utf-8'));

  for (const capability of capabilities) {
    const { filePath } = capability;

    writeFileSync(`${__dirname}/${filePath}`, template(capability));
    console.log(`Wrote ${filePath}`);
  }
}

function generateCapabilityIndex() {
  const template = Handlebars.compile(readFileSync('./codegen/templates/capability_index.ts.hbs', 'utf-8'));
  const filePath = `../models/capabilities/index.gen.ts`;

  writeFileSync(`${__dirname}/${filePath}`, template({ capabilities }));
  console.log(`Wrote ${filePath}`);
}

generateCapabilityIndex();
generateCapabilityModels();