const path = require('path');
const {parse:parseSfc} = require('@vue/compiler-sfc');
const {parseTree,findNodeAtLocation,getNodeValue,printParseErrorCode} = require('jsonc-parser');

async function inspectComponent(filename,source,readFile) {
  const {descriptor,errors} = parseSfc(source,{filename});
  if(errors.length) return {sources:[],errors:errors.map(e=>typeof e==='string'?e:e.message)};
  const sources=[],issues=[];
  for(const block of descriptor.customBlocks.filter(b=>b.type==='i18n')) {
    const lang=block.lang||'json';
    if(lang!=='json') {issues.push(`Unsupported message format: ${lang}. Only JSON is inspected.`);continue;}
    let content=block.content,file=filename,baseOffset=block.loc.start.offset;
    if(block.src) {
      if(!block.src.startsWith('./')&&!block.src.startsWith('../')) {issues.push(`Unsupported source path: ${block.src}. Use a relative JSON file.`);continue;}
      file=path.resolve(path.dirname(filename),block.src);baseOffset=0;
      try {content=await readFile(file);} catch {issues.push(`Cannot read translation file: ${block.src}`);continue;}
    }
    const parseErrors=[];
    const tree=parseTree(content,parseErrors,{allowTrailingComma:false,disallowComments:true});
    if(parseErrors.length||tree?.type!=='object') {issues.push(`Invalid JSON in ${path.basename(file)}: ${parseErrors.map(e=>printParseErrorCode(e.error)).join(', ')||'expected an object'}`);continue;}
    const locales=block.attrs.locale?[{locale:String(block.attrs.locale),tree}]:
      (tree.children||[]).filter(p=>p.children[1].type==='object').map(p=>({locale:getNodeValue(p.children[0]),tree:p.children[1]}));
    if(!locales.length) {issues.push(`No locale objects found in ${path.basename(file)}.`);continue;}
    sources.push({file,content,baseOffset,locales});
  }
  return {sources,errors:issues};
}

function lookup(model,key,locale='en') {
  const found=[];
  for(const source of model.sources) for(const entry of source.locales) {
    const exact=findNodeAtLocation(entry.tree,[key]);
    const node=exact||findNodeAtLocation(entry.tree,key.split('.'));
    if(node&&['string','number','boolean'].includes(node.type))
      found.push({locale:entry.locale,value:getNodeValue(node),file:source.file,content:source.content,offset:source.baseOffset+node.offset,length:node.length});
  }
  return found.sort((a,b)=>(a.locale===locale?-1:0)-(b.locale===locale?-1:0));
}

// Only direct, literal template interpolations with an explicit local composer.
// Unknown bindings and template scopes intentionally produce no result.
function references(source) {
  try {
    const {descriptor,errors}=parseSfc(source);
    if(errors.length||!descriptor.scriptSetup||!descriptor.template) return [];
    const {parse,parseExpression}=require('@babel/parser');
    const {baseParse}=require('@vue/compiler-dom');
    const script=parse(descriptor.scriptSetup.content,{sourceType:'module',plugins:['typescript']});
    const imported=script.program.body.some(n=>n.type==='ImportDeclaration'&&n.source.value==='vue-i18n'&&
      n.importKind!=='type'&&n.specifiers.some(s=>s.type==='ImportSpecifier'&&s.importKind!=='type'&&s.imported.name==='useI18n'&&s.local.name==='useI18n'));
    if(!imported) return [];
    const local=script.program.body.some(n=>n.type==='VariableDeclaration'&&n.kind==='const'&&n.declarations.some(d=>{
      if(d.id.type!=='ObjectPattern'||!d.id.properties.some(p=>p.type==='ObjectProperty'&&!p.computed&&p.key.name==='t'&&p.value.type==='Identifier'&&p.value.name==='t'))return false;
      const call=d.init;
      if(call?.type!=='CallExpression'||call.callee.type!=='Identifier'||call.callee.name!=='useI18n'||call.arguments.length!==1)return false;
      const options=call.arguments[0];
      return options.type==='ObjectExpression'&&options.properties.length===1&&options.properties[0].type==='ObjectProperty'&&
        !options.properties[0].computed&&(options.properties[0].key.name||options.properties[0].key.value)==='useScope'&&
        options.properties[0].value.type==='StringLiteral'&&options.properties[0].value.value==='local';
    }));
    if(!local)return [];
    const result=[];
    function visit(node) {
      // v-for, slots and custom scope directives are outside this small demo.
      if(node.type===1&&node.props.some(p=>p.type===7&&!['if','else','else-if','bind','on','show','model','once','memo','text','html','cloak'].includes(p.name)))return;
      if(node.type===5){
        let expression;
        try{expression=parseExpression(node.content.content);}catch{return;}
        if(expression.type!=='CallExpression'||expression.callee.type!=='Identifier'||expression.callee.name!=='t'||expression.arguments.length!==1)return;
        const arg=expression.arguments[0];
        if(arg.type!=='StringLiteral'||!arg.value||arg.extra.raw.slice(1,-1)!==arg.value)return;
        const start=descriptor.template.loc.start.offset+node.content.loc.start.offset+arg.start+1;
        result.push({key:arg.value,start,end:start+arg.value.length});
      }
      for(const child of node.children||[])visit(child);
    }
    visit(baseParse(descriptor.template.content));
    return result;
  }catch{return [];}
}
module.exports={inspectComponent,lookup,references};
