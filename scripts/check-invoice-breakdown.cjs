const fs = require('node:fs'), path = require('node:path'), ts = require('typescript'), assert = require('node:assert/strict');
function load(file) { const mod = {exports:{}}; new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>load(path.resolve(path.dirname(file),name+'.ts')),mod,mod.exports); return mod.exports; }
const {parseInvoiceLines, invoiceTotal}=load('lib/invoice.ts');
const breakdown=[{description:'Sticker',dimensions:'5 x 5 cm',quantity:100},{description:'Sticker',dimensions:'10 x 10 cm',quantity:50}];
const parsed=parseInvoiceLines([{description:'Sticker order',quantity:1,unitPrice:'250.00',breakdown}]);
assert.deepEqual(parsed[0].breakdown,breakdown); assert.equal(invoiceTotal(parsed),25000);
assert.equal(parseInvoiceLines([{description:'Sticker order',quantity:1,unitPrice:'250.00',breakdown:[{...breakdown[0],quantity:0}]}]),null);
assert.equal(invoiceTotal(parseInvoiceLines([{description:'Existing',quantity:2,unitPrice:'5.00'}])),1000);
console.log('PASS invoice variation preservation, total, validation and existing invoices');
