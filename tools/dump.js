var fs=require('fs'),path=require('path'),vm=require('vm');
['engine','caves'].forEach(function(f){vm.runInThisContext(fs.readFileSync(path.join(__dirname,'..','js',f+'.js'),'utf8'));});
var n=parseInt(process.argv[2]||'1',10)-1; console.log(DH.CAVES[n].rows.join('\n'));
