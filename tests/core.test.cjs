const {test}=require('node:test');
const assert=require('node:assert/strict');
const {inspectComponent,lookup,references}=require('../core.cjs');
const component='/fixture/Example.vue';
const call='<script setup>import { useI18n } from "vue-i18n"; const { t } = useI18n({useScope:"local"})</script><template>{{ t("hello") }}</template>';
test('external file resolves both locales with valid definition offsets',async()=>{
  const body='{"en":{"hello":"Hello"},"fr":{"hello":"Bonjour"}}';
  const model=await inspectComponent(component,call+'<i18n src="./messages.json"/>',async file=>{assert.equal(file,'/fixture/messages.json');return body;});
  assert.deepEqual(model.errors,[]);
  const values=lookup(model,'hello');assert.deepEqual(values.map(v=>v.value),['Hello','Bonjour']);
  for(const value of values)assert.equal(JSON.parse(body.slice(value.offset,value.offset+value.length)),value.value);
});
test('inline, locale attribute, nested and literal dot keys resolve',async()=>{
  const source=call+'<i18n locale="en">{"hello":"Hi","user":{"name":"Nested"},"user.name":"Literal"}</i18n>';
  const model=await inspectComponent(component,source,async()=>{throw Error('should not read');});
  assert.equal(lookup(model,'user.name')[0].value,'Literal');
  const value=lookup(model,'hello')[0];assert.equal(JSON.parse(source.slice(value.offset,value.offset+value.length)),'Hi');
});
test('missing files, unsupported format and invalid JSON produce explicit warnings',async()=>{
  for(const [block,read,expected] of [
    ['<i18n src="./missing.json"/>',async()=>{throw Error('missing');},'Cannot read'],
    ['<i18n lang="yaml">en: x</i18n>',async()=>'', 'Unsupported'],
    ['<i18n src="./broken.json"/>',async()=>'{','Invalid JSON']
  ]){const result=await inspectComponent(component,call+block,read);assert.equal(result.sources.length,0);assert.match(result.errors.join(),new RegExp(expected));}
});
test('component isolation and edits are resolved from supplied fresh contents',async()=>{
  const one=await inspectComponent(component,call+'<i18n src="./messages.json"/>',async()=>' {"en":{"hello":"One"}}');
  const two=await inspectComponent('/other/Example.vue',call+'<i18n src="./messages.json"/>',async()=>' {"en":{"hello":"Two"}}');
  assert.equal(lookup(one,'hello')[0].value,'One');assert.equal(lookup(two,'hello')[0].value,'Two');assert.equal(lookup(one,'absent').length,0);
});
test('literal template reference retains the exact source range',()=>{
  const refs=references(call);assert.deepEqual(refs.map(r=>r.key),['hello']);
  for(const ref of refs)assert.equal(call.slice(ref.start,ref.end),ref.key);
});
test('ambiguous composers and nonlocal calls never show local messages',()=>{
  const variants=[
    call.replace('vue-i18n','unrelated'),
    call.replace('"local"','"global"'),
    call.replace('{useScope:"local"}','{useScope:"local", messages: other}'),
    call.replace('{ t }','{ t: other }'),
    call.replace('{{ t("hello") }}','{{ $t("hello") }}'),
    call.replace('{{ t("hello") }}','{{ t(key) }}'),
    call.replace('{{ t("hello") }}','<!-- {{ t("hello") }} -->'),
    call.replace('{{ t("hello") }}',"{{ 't(hello)' }}"),
    call.replace('{{ t("hello") }}','<div v-for="t in items">{{ t("hello") }}</div>'),
    call.replace('{{ t("hello") }}','<Widget v-slot="{ t }">{{ t("hello") }}</Widget>'),
    '<template>{{ t("unrelated") }}</template>'
  ];
  for(const source of variants)assert.deepEqual(references(source),[],source);
});
test('script calls, attributes and template text are outside the supported scope',()=>{
  const source=call.replace('</script>','; const sample=t("script");</script>').replace('{{ t("hello") }}','t("text") <p :title="t(\'attr\')">{{ t("hello") }}</p>');
  assert.deepEqual(references(source).map(r=>r.key),['hello']);
});
