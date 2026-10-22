const vscode=require('vscode');
const {inspectComponent,lookup,references}=require('./core.cjs');

exports.activate=context=>{
  const diagnostics=vscode.languages.createDiagnosticCollection('vue-message-lens');
  const selector={language:'vue',scheme:'file'};
  const read=async file=>{
    const uri=vscode.Uri.file(file);
    const open=vscode.workspace.textDocuments.find(d=>d.uri.toString()===uri.toString());
    return open?open.getText():Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
  };
  const model=document=>inspectComponent(document.uri.fsPath,document.getText(),read);
  const keyAt=(document,position)=>references(document.getText()).find(r=>document.offsetAt(position)>=r.start&&document.offsetAt(position)<=r.end);
  const refresh=async document=>{
    if(document.languageId!=='vue'||document.uri.scheme!=='file')return;
    const report=await model(document);
    const range=new vscode.Range(0,0,0,0);
    diagnostics.set(document.uri,report.errors.map(message=>new vscode.Diagnostic(range,message,vscode.DiagnosticSeverity.Warning)));
  };
  const refreshOpen=()=>Promise.all(vscode.workspace.textDocuments.map(refresh));
  context.subscriptions.push(diagnostics,
    vscode.languages.registerHoverProvider(selector,{async provideHover(document,position){
      const reference=keyAt(document,position);if(!reference)return;
      const report=await model(document);
      const values=lookup(report,reference.key);if(!values.length)return;
      const content=new vscode.MarkdownString();
      content.appendText(`Component translation: ${reference.key}\n\n`);
      for(const value of values)content.appendText(`${value.locale}: ${value.value}\n\n`);
      return new vscode.Hover(content,new vscode.Range(document.positionAt(reference.start),document.positionAt(reference.end)));
    }}),
    vscode.languages.registerDefinitionProvider(selector,{async provideDefinition(document,position){
      const reference=keyAt(document,position);if(!reference)return;
      const report=await model(document);
      const values=lookup(report,reference.key);
      return Promise.all(values.map(async value=>{
        const target=await vscode.workspace.openTextDocument(vscode.Uri.file(value.file));
        return new vscode.Location(target.uri,new vscode.Range(target.positionAt(value.offset),target.positionAt(value.offset+value.length)));
      }));
    }}),
    vscode.workspace.onDidOpenTextDocument(refresh),
    vscode.workspace.onDidChangeTextDocument(()=>refreshOpen()),
    vscode.workspace.onDidCloseTextDocument(doc=>diagnostics.delete(doc.uri)),
    vscode.workspace.onDidCreateFiles(refreshOpen),vscode.workspace.onDidDeleteFiles(refreshOpen)
  );
  const watcher=vscode.workspace.createFileSystemWatcher('**/*.json');
  context.subscriptions.push(watcher,watcher.onDidChange(refreshOpen),watcher.onDidCreate(refreshOpen),watcher.onDidDelete(refreshOpen));
  refreshOpen();
};
