const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Nur Importe mit ausdrücklichem `node:`-Präfix werden umgeleitet. Bare Namen wie
// "path" bleiben unangetastet, damit nichts still kaputtgeht, was sie in React
// Native tatsächlich sinnvoll auflöst.
const stubPfad = path.resolve(__dirname, 'metro-node-stub.js');
const urspruenglich = config.resolver.resolveRequest;

config.resolver.resolveRequest = (kontext, modulName, plattform) => {
  if (modulName.startsWith('node:')) {
    return { type: 'sourceFile', filePath: stubPfad };
  }
  return urspruenglich
    ? urspruenglich(kontext, modulName, plattform)
    : kontext.resolveRequest(kontext, modulName, plattform);
};

module.exports = config;
