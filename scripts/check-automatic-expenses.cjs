const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),assert=require('node:assert/strict');
function load(file){const mod={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>load(path.resolve(path.dirname(file),name+'.ts')),mod,mod.exports);return mod.exports;}
const {withOrderExpenses,financialSummary,totals}=load('lib/finance.ts'),{profitReport}=load('lib/profit.ts');
const base={status:'Completed',currency:'GHS',client:'',title:'Order',notes:'',service:'Printing',due_date:'2026-12-01',created_at:Date.parse('2026-10-01T10:00:00Z'),direction:'',amount:''};
const order={...base,id:'o1',kind:'project',price:'1000',cost:'600'};
const earned={...base,id:'income',kind:'finance',direction:'Income',amount:'1000',project_id:'o1'};
const expense={...base,id:'paid',kind:'finance',direction:'Expense',amount:'200',project_id:'o1'};
const shared={...base,id:'salary',kind:'finance',direction:'Expense',amount:'100',category:'Salary'};
let rows=[order,earned,expense,shared],normalized=withOrderExpenses(rows);
assert.equal(financialSummary(rows,'GHS').expenses,70000);assert.equal(financialSummary(rows,'GHS').profit,30000);
assert.equal(normalized.find(r=>r.auto_order_cost).amount,'400.00');
assert.deepEqual(withOrderExpenses(normalized),normalized);
assert.equal(totals(normalized.filter(r=>r.kind==='finance')).expenses,70000);
assert.equal(financialSummary(normalized,'GHS').expenses,70000);
assert.equal(profitReport(rows,'GHS').expenses,70000);
assert.equal(profitReport(rows,'GHS','2026-10-01','2026-10-01').expenses,40000); // auto remainder uses order creation date; legacy payments retain their own date.
assert.equal(profitReport(rows,'GHS','2026-12-01','2026-12-01').expenses,30000);
assert.equal(withOrderExpenses([{...order,cost:'100'},expense]).filter(r=>r.auto_order_cost).length,0);
assert.equal(financialSummary([{...order,cost:'100'},expense],'GHS').expenses,20000);
assert.equal(financialSummary([{...order,cost:'750'},expense],'GHS').expenses,75000);
assert.equal(financialSummary([{...order,cost:'0'}],'GHS').expenses,0);
assert.equal(financialSummary([order,{...expense,status:'Pending'}],'GHS').expenses,60000);
assert.equal(financialSummary([order,{...expense,currency:'USD'}],'GHS').expenses,60000);
assert.equal(financialSummary([order,{...expense,project_id:'other'}],'GHS').expenses,80000);
assert.equal(financialSummary([{...order,kind:'booking',status:'Cancelled'}],'GHS').expenses,60000);
assert.equal(withOrderExpenses([order]).find(r=>r.auto_order_cost).due_date,'2026-10-01');
console.log('PASS automatic order expenses, profit, legacy payment offsets, idempotence, report dates, edits, zero costs, pending payments, and currency isolation.');
