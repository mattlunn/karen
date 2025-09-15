"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var handlebars_1 = require("handlebars");
var fs_1 = require("fs");
var capabilities = require('../capabilities.json').map(function (_a) {
    var name = _a.name, properties = _a.properties, _b = _a.capabilityModelClassName, capabilityModelClassName = _b === void 0 ? null : _b;
    var moduleName = "".concat(name.replace(/[A-Z]/g, function (letter) { return "_".concat(letter.toLowerCase()); }).replace(/^_/, ''), ".gen");
    return {
        moduleName: moduleName,
        className: "".concat(capabilityModelClassName || name, "Capability"),
        capabilityName: "".concat(name, "Capability"),
        properties: properties.map(function (x) {
            return {
                propertyName: x.name,
                isBoolean: x.type === 'boolean',
                isWriteable: x.isWriteable,
                eventName: x.eventName,
            };
        })
    };
});
function generateCapabilityModels() {
    var template = handlebars_1.default.compile((0, fs_1.readFileSync)('./codegen/templates/capabilities.ts.hbs', 'utf-8'));
    var filePath = "../models/capabilities/capabilities.gen.ts";
    var providers = capabilities.filter(function (x) { return x.properties.some(function (x) { return x.isWriteable; }); });
    (0, fs_1.writeFileSync)("".concat(__dirname, "/").concat(filePath), template({ capabilities: capabilities, providers: providers }));
    console.log("Wrote ".concat(filePath));
}
generateCapabilityModels();
