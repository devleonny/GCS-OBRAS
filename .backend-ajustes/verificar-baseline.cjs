const fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path');
const original=fs.readFileSync;
const baseline=cp.execFileSync('git',['show','HEAD:js/colaboradores.js'],{encoding:'utf8'});
fs.readFileSync=function(file,...args){if(path.resolve(String(file))===path.resolve('js/colaboradores.js'))return baseline;return original.call(this,file,...args)};
require('../tests/colaboradores.test.cjs');
