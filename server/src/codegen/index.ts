import Handlebars from 'handlebars';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

type CapabilityDescriptor = {
  name: string;
  properties: PropertyDescriptor[];
  capabilityModelClassName?: string;
  capabilityProviderClassName?: string;
}

type PropertyDescriptor = {
  name: string;
  isWriteable: boolean;
  eventName: string;
  isMomentary?: boolean;
} & ({
  type: 'boolean' | 'number';
} | {
  type: 'string';
  enum?: string[];
});

const toSnakeCase = (x: string) => x.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`).replace(/^_/, '');
const toPascalUpperCase = (x: string) => x.replace(/([A-Z])/g, '_$1').slice(1).toUpperCase();

function describeProperty(capabilityName: string, p: PropertyDescriptor) {
  let valueType: string;
  let eventType: string;
  let typeAlias: string | null = null;
  let enumValues: string[] | null = null;

  switch (p.type) {
    case 'boolean':
      valueType = 'boolean';
      eventType = 'BooleanEvent';
      break;
    case 'number':
      valueType = 'number';
      eventType = 'NumericEvent';
      break;
    case 'string':
      eventType = 'StringEvent';

      if (p.enum) {
        typeAlias = `${capabilityName}${p.name}`;
        enumValues = p.enum;
        valueType = typeAlias;
      } else {
        valueType = 'string';
      }
      
      break;
  }

  return {
    propertyName: p.name,
    propertyEnumName: toPascalUpperCase(p.name),
    isBoolean: p.type === 'boolean',
    isString: p.type === 'string',
    isMomentary: p.isMomentary ?? false,
    isWriteable: p.isWriteable,
    eventType,
    valueType,
    typeAlias,
    enumValues,
    fieldName: p.eventName,
  };
}

const capabilities = (JSON.parse(readFileSync(__dirname + '/../capabilities.json', 'utf-8')) as CapabilityDescriptor[]).map(({ name, properties, capabilityModelClassName = null, capabilityProviderClassName = null }) => {
  const moduleName = `${toSnakeCase(name)}.gen`;
  const capabilityEnumName = toPascalUpperCase(name);

  return {
    moduleName,
    className: `${capabilityModelClassName || name}Capability`,
    providerClassName: capabilityProviderClassName,
    capabilityName: name,
    capabilityEnumName,
    properties: properties.map(p => describeProperty(name, p))
  };
});

const enumAliases = capabilities.flatMap(c =>
  c.properties
    .filter(p => p.typeAlias && p.enumValues)
    .map(p => ({
      name: p.typeAlias!,
      values: p.enumValues!.map(v => `'${v}'`).join(' | '),
    }))
);

function generateCapabilityModels() {
  const template = Handlebars.compile(readFileSync('./codegen/templates/capabilities.ts.hbs', 'utf-8'));
  const filePath = `../models/capabilities/capabilities.gen.ts`;
  const providers = capabilities.filter(x => x.properties.some(x => x.isWriteable));

  writeFileSync(`${__dirname}/${filePath}`, template({ capabilities, providers, enumAliases }));

  console.log(`Wrote ${filePath}`);
}

generateCapabilityModels();