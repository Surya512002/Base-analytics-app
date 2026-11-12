const solc = require('solc'); const fs = require('fs');
const src = fs.readFileSync(process.argv[2],'utf8');
const input = {language:'Solidity',sources:{'C.sol':{content:src}},settings:{optimizer:{enabled:true,runs:200},evmVersion:'shanghai',outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}};
const out = JSON.parse(solc.compile(JSON.stringify(input)));
(out.errors||[]).forEach(e=>console.log(e.severity, e.formattedMessage));
const c = out.contracts && out.contracts['C.sol'];
if (c) { fs.writeFileSync(process.argv[3], JSON.stringify(Object.fromEntries(Object.entries(c).map(([k,v])=>[k,{abi:v.abi,bytecode:'0x'+v.evm.bytecode.object}])))); console.log('OK', Object.keys(c)); }
