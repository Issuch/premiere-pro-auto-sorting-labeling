(function(){
  if(typeof window.CSInterface==='function'){return;}
  function CSInterface(){}
  CSInterface.prototype.evalScript=function(script,cb){try{window.__adobe_cep__.evalScript(script,function(res){if(cb)cb(res);});}catch(e){if(cb)cb('EvalScript error.');}}
  CSInterface.prototype.addEventListener=function(type,listener){try{window.__adobe_cep__.addEventListener(type,listener);}catch(e){}}
  CSInterface.prototype.removeEventListener=function(type,listener){try{window.__adobe_cep__.removeEventListener(type,listener);}catch(e){}}
  window.CSInterface=CSInterface;
})();
