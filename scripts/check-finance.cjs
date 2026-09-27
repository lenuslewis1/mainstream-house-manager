const fs=require("node:fs"),path=require("node:path"),ts=require("typescript"),assert=require("node:assert/strict");
function load(file){const mod={exports:{}};new Function("require","module","exports",ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>load(path.resolve(path.dirname(file),name+".ts")),mod,mod.exports);return mod.exports;}
const finance=load("lib/finance.ts"),reports=load("lib/finance-reports.ts");
const base={status:"Completed",currency:"GHS",client:"Client",title:"Record",notes:"",service:"",due_date:"2026-09-15",created_at:Date.parse("2026-09-01T00:00:00Z"),direction:"",amount:""};
const order={...base,id:"o",kind:"project",price:"1000",cost:"600"};
const entries=[order,{...base,id:"deposit",kind:"finance",direction:"Income",amount:"300",project_id:"o"},{...base,id:"cost",kind:"finance",direction:"Expense",amount:"200",project_id:"o"},{...base,id:"general",kind:"finance",direction:"Expense",amount:"50"},{...base,id:"pending",kind:"finance",status:"Pending",direction:"Income",amount:"700",project_id:"o"},{...base,id:"usd",kind:"finance",currency:"USD",direction:"Income",amount:"900"}];
const s=finance.financialSummary(entries,"GHS");assert.equal(s.revenue,100000);assert.equal(s.expenses,65000);assert.equal(s.profit,35000);assert.equal(s.received,30000);assert.equal(s.pendingIncome,70000);
const [b]=reports.orderBalances(entries,"GHS");assert.equal(b.balance,70000);assert.equal(b.costRemaining,40000);assert.equal(b.variance,40000);
const [over]=reports.orderBalances([...entries,{...base,id:"extra",kind:"finance",direction:"Income",amount:"800",project_id:"o"},{...base,id:"extra-cost",kind:"finance",direction:"Expense",amount:"500",project_id:"o"}],"GHS");assert.equal(over.balance,0);assert.equal(over.credit,10000);assert.equal(over.variance,-10000);
assert.equal(reports.inPeriod(order,"2026-09-01","2026-09-01"),true);assert.equal(reports.inPeriod(entries[1],"2026-09-01","2026-09-01"),false);
assert.equal(reports.parseFinanceDetails({category:"Made up"}),null);assert.equal(reports.parseFinanceDetails({paymentMethod:"Cash",reference:"Ref-1"}).reference,"Ref-1");
const csv=reports.csvText([["=HYPERLINK(x)","name,with comma",'-25.00', 'A"B']]);assert.ok(csv.includes("'=HYPERLINK"));assert.ok(csv.includes('"-25.00"'));assert.ok(csv.includes('"A""B"'));
console.log("Finance checks passed: no double counting, currency separation, deposits, pending exclusions, customer credit, budget overruns, date basis, metadata, and safe CSV.");
