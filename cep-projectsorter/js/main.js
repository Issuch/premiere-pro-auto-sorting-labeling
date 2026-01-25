(function(){
  var cs = new CSInterface();
  function $(id){return document.getElementById(id)}
  function setStatus(t){var s=$("status"); if(s) s.textContent=t}
  function evalJSX(code, cb){try{cs.evalScript(code, function(res){if(cb)cb(res)})}catch(e){setStatus('Error'); try{ if(cb) cb('ERR:' + e); }catch(_e2){} }}
  function sortOnce(){
    var s;
    try{ s = currentSettings(); }catch(_e0){ s = {}; }
    try{ saveSettings(s); }catch(_e1){}

    // Apply config and run sort in a single evalScript to avoid async ordering issues.
    try{
      var apply = s.applyLabels ? 1 : 0;
      var labels = s.labels || {};
      var args = [apply, labels.Video||0, labels.VideoOnly||0, labels.Audio||0, labels.Images||0, labels.Graphics||0, labels.Sequences||0];

      var bn = s.binNames || {};
      function q(v){ return JSON.stringify(String(v||'')); }
      var se = s.sortEnabledByType || { Video:true, VideoOnly:true, Audio:true, Images:true, Graphics:true, Sequences:true };
      var sortArgs = [
        q(bn.Video || 'Video'),
        q(bn.VideoOnly || 'VideoOnly'),
        q(bn.Audio || 'Audio'),
        q(bn.Images || 'Images'),
        q(bn.Graphics || 'Graphics'),
        q(bn.Sequences || 'Sequences'),
        0,
        q(''),
        q(''),
        se.Video ? 1 : 0,
        se.VideoOnly ? 1 : 0,
        se.Audio ? 1 : 0,
        se.Images ? 1 : 0,
        se.Graphics ? 1 : 0,
        se.Sequences ? 1 : 0
      ];

      // Pass rules as a direct array literal to avoid fragile double JSON encoding.
      var rulesPayload = JSON.stringify(s.rules || []);
      var script = '';
      script += 'projectSorter_setLabelConfig(' + args.join(',') + ');';
      script += 'projectSorter_setSortConfig(' + sortArgs.join(',') + ');';
      script += 'projectSorter_setRulesConfig(' + rulesPayload + ');';
      script += 'projectSorter_sortAll(false);';

      setStatus('Sorting...');
      evalJSX(script, function(res){
        var out = (res && String(res)) || '';
        if(out.indexOf('ERR') === 0){
          setStatus(out);
          return;
        }
        if(s && s.debugMode){
          setStatus(out || 'Done');
        }else{
          setStatus('Done');
        }
      });
    }catch(_e2){
      setStatus('Sorting...');
      evalJSX('projectSorter_sortAll(false);', function(res){
        var out = (res && String(res)) || '';
        if(out.indexOf('ERR') === 0){
          setStatus(out);
          return;
        }
        if(s && s.debugMode){
          setStatus(out || 'Done');
        }else{
          setStatus('Done');
        }
      });
    }
  }

  var autoOn=false; var importListeners=[]; var lastCount=null; var autoDebounceTimer=null;
  var autoBusy=false; var autoQueued=false; var autoForcePending=false; var autoBusySince=0;
  var tlLabelDebounceTimer=null; var tlLabelBusy=false; var tlLabelQueued=false; var tlLabelLastAt=0; var tlLabelBusySince=0;
  var fallbackPollTimer=null;
  var fallbackDelayMs=1200;
  var fallbackFastEndsAt=0;
  var binOrder=["Video","VideoOnly","Audio","Images","Graphics","Sequences"];
  // Approximate Premiere label palette (16)
  var labelPalette=[
    {name:'Lavender', hex:'#751187'},
    {name:'Cerulean', hex:'#05555B'},
    {name:'Forest', hex:'#3D4A00'},
    {name:'Rose', hex:'#8C0235'},
    {name:'Mango', hex:'#893A04'},
    {name:'Iris', hex:'#004B67'},
    {name:'Caribbean', hex:'#2A5507'},
    {name:'Magenta', hex:'#840D58'},
    {name:'Violet', hex:'#3E0AAE'},
    {name:'Blue', hex:'#122D9A'},
    {name:'Green', hex:'#0D5D27'},
    {name:'Yellow', hex:'#6F6619'},
    {name:'Teal', hex:'#014E45'},
    {name:'Purple', hex:'#6100B7'},
    {name:'Tan', hex:'#6F5A45'},
    {name:'None', hex:'#3a3a3a'}
  ];

  function syncLabelSelectOptionTexts(sel){
    try{
      if(!sel || !sel.options) return;
      for(var i=0;i<sel.options.length;i++){
        sel.options[i].textContent = 'Label ' + String(i);
      }
    }catch(e){}
  }

  function syncAllLabelSelectOptionTexts(){
    try{
      syncLabelSelectOptionTexts($("label-Video"));
      syncLabelSelectOptionTexts($("label-Audio"));
      syncLabelSelectOptionTexts($("label-Images"));
      syncLabelSelectOptionTexts($("label-Graphics"));
      syncLabelSelectOptionTexts($("label-Sequences"));

      // Rules: update already-rendered selects too
      var c = $('rulesContainer');
      if(c){
        var sels = c.querySelectorAll('select[data-rule-label]');
        for(var j=0;j<sels.length;j++){
          syncLabelSelectOptionTexts(sels[j]);
        }
      }
    }catch(e){}
  }

  function refreshLabelNamesFromPremiere(){
    return;
  }

  function loadSettings(){
    try{ return JSON.parse(localStorage.getItem('ps_settings')||'{}'); }catch(_){ return {}; }
  }
  function saveSettings(s){ localStorage.setItem('ps_settings', JSON.stringify(s)); }

  function normalizeSettings(s){
    s = s || {};
    if(!s.rules){
      s.rules = [];
    }
    if(!s.sortEnabledByType){
      s.sortEnabledByType = { Video:true, VideoOnly:true, Audio:true, Images:true, Graphics:true, Sequences:true };
    }
    // migrate legacy audioNameFilter into rules
    if(s.rules.length === 0 && s.audioNameFilter && s.audioNameFilter.enabled && s.audioNameFilter.keyword && s.audioNameFilter.targetBin){
      s.rules.push({
        enabled: true,
        type: 'Audio',
        keyword: String(s.audioNameFilter.keyword || ''),
        targetBin: String(s.audioNameFilter.targetBin || ''),
        label: (s.labels && typeof s.labels.Audio !== 'undefined') ? parseInt(s.labels.Audio||0,10) : 0
      });
    }
    return s;
  }

  function currentSettings(){
    var s = normalizeSettings(loadSettings());
    s.autoOnStartup = !!($('autoOnStartup') && $('autoOnStartup').checked);
    s.debugMode = !!($('debugMode') && $('debugMode').checked);
    var apply = !!($("applyLabels") && $("applyLabels").checked);
    s.applyLabels = apply;

    s.sortEnabledByType = s.sortEnabledByType || { Video:true, VideoOnly:true, Audio:true, Images:true, Graphics:true, Sequences:true };
    for(var i=0;i<binOrder.length;i++){
      var t = binOrder[i];
      var ch = $('sort-' + t);
      if(ch){ s.sortEnabledByType[t] = !!ch.checked; }
    }

    s.binNames = s.binNames || {};
    for(var i=0;i<binOrder.length;i++){
      var bn = binOrder[i];
      var binEl = $('bin-' + bn);
      var nm = binEl ? String(binEl.value||'').trim() : '';
      if(nm){ s.binNames[bn] = nm; }
    }

    // rules are managed by UI in renderRules()
    s.rules = readRulesFromUI();

    s.labels = s.labels || {};
    for(var i=0;i<binOrder.length;i++){
      var id = 'label-' + binOrder[i];
      var el = $(id);
      var val = el? parseInt(el.value||'0',10) : 0;
      s.labels[binOrder[i]] = isNaN(val)?0:val;
    }
    return s;
  }

  function readRulesFromUI(){
    var c = $('rulesContainer');
    if(!c) return [];
    var rows = c.querySelectorAll('[data-rule-row="1"]');
    var rules = [];
    for(var i=0;i<rows.length;i++){
      var r = rows[i];
      var enabled = !!(r.querySelector('[data-rule-enabled]') && r.querySelector('[data-rule-enabled]').checked);
      var type = String((r.querySelector('[data-rule-type]') && r.querySelector('[data-rule-type]').value) || 'Any');
      var keyword = String((r.querySelector('[data-rule-keyword]') && r.querySelector('[data-rule-keyword]').value) || '').trim();
      var targetBin = String((r.querySelector('[data-rule-target]') && r.querySelector('[data-rule-target]').value) || '').trim();
      var label = parseInt((r.querySelector('[data-rule-label]') && r.querySelector('[data-rule-label]').value) || '0',10);
      rules.push({ enabled: enabled, type: type, keyword: keyword, targetBin: targetBin, label: isNaN(label)?0:label });
    }
    return rules;
  }

  function pushConfigToJSX(){
    var s = currentSettings();
    var args = [s.applyLabels?1:0, s.labels.Video||0, s.labels.VideoOnly||0, s.labels.Audio||0, s.labels.Images||0, s.labels.Graphics||0, s.labels.Sequences||0];
    evalJSX('projectSorter_setLabelConfig(' + args.join(',') + ');');

    // Sorting config: bin names + optional audio keyword routing
    var bn = s.binNames || {};
    function q(v){ return JSON.stringify(String(v||'')); }
    var se = s.sortEnabledByType || { Video:true, VideoOnly:true, Audio:true, Images:true, Graphics:true, Sequences:true };
    var sortArgs = [
      q(bn.Video || 'Video'),
      q(bn.VideoOnly || 'VideoOnly'),
      q(bn.Audio || 'Audio'),
      q(bn.Images || 'Images'),
      q(bn.Graphics || 'Graphics'),
      q(bn.Sequences || 'Sequences'),
      0,
      q(''),
      q(''),
      se.Video ? 1 : 0,
      se.VideoOnly ? 1 : 0,
      se.Audio ? 1 : 0,
      se.Images ? 1 : 0,
      se.Graphics ? 1 : 0,
      se.Sequences ? 1 : 0
    ];
    evalJSX('projectSorter_setSortConfig(' + sortArgs.join(',') + ');');

    evalJSX('projectSorter_setRulesConfig(' + JSON.stringify(s.rules || []) + ');');
  }

  function renderRules(rules){
    var c = $('rulesContainer');
    if(!c) return;
    c.innerHTML = '';
    rules = rules || [];

    function makeLabelSelect(value){
      var sel = document.createElement('select');
      sel.setAttribute('data-rule-label','1');
      for(var i=0;i<labelPalette.length;i++){
        var opt=document.createElement('option');
        opt.value=String(i);
        opt.textContent='Label ' + String(i);
        sel.appendChild(opt);
      }
      sel.value = String(typeof value === 'number' ? value : 0);
      return sel;
    }

    function makeTypeSelect(value){
      var sel = document.createElement('select');
      sel.setAttribute('data-rule-type','1');
      var types = ['Any'].concat(binOrder);
      for(var i=0;i<types.length;i++){
        var opt=document.createElement('option');
        opt.value=types[i];
        opt.textContent=types[i];
        sel.appendChild(opt);
      }
      sel.value = String(value || 'Any');
      return sel;
    }

    function onAnyChange(){
      saveSettings(currentSettings());
      pushConfigToJSX();
    }

    for(var i=0;i<rules.length;i++){
      var rule = rules[i] || {};
      var row = document.createElement('div');
      row.setAttribute('data-rule-row','1');
      row.style.display='grid';
      row.style.gridTemplateColumns='auto 120px 1fr 1fr 140px auto';
      row.style.gap='6px';
      row.style.alignItems='center';
      row.style.margin='6px 0';

      var en = document.createElement('input');
      en.type='checkbox';
      en.checked = (rule.enabled !== false);
      en.setAttribute('data-rule-enabled','1');

      var typeSel = makeTypeSelect(rule.type);

      var kw = document.createElement('input');
      kw.type='text';
      kw.placeholder='Keyword';
      kw.value = String(rule.keyword || '');
      kw.setAttribute('data-rule-keyword','1');

      var target = document.createElement('input');
      target.type='text';
      target.placeholder='Target bin';
      target.value = String(rule.targetBin || '');
      target.setAttribute('data-rule-target','1');

      var lblSel = makeLabelSelect((typeof rule.label === 'number') ? rule.label : 0);

      var rm = document.createElement('button');
      rm.className='btn';
      rm.type='button';
      rm.textContent='-';
      rm.addEventListener('click', function(ev){
        var r0 = ev.target && ev.target.parentNode;
        if(r0 && r0.parentNode){ r0.parentNode.removeChild(r0); onAnyChange(); }
      });

      en.addEventListener('change', onAnyChange);
      typeSel.addEventListener('change', onAnyChange);
      kw.addEventListener('input', onAnyChange);
      target.addEventListener('input', onAnyChange);
      lblSel.addEventListener('change', onAnyChange);

      row.appendChild(en);
      row.appendChild(typeSel);
      row.appendChild(kw);
      row.appendChild(target);
      row.appendChild(lblSel);
      row.appendChild(rm);
      c.appendChild(row);
    }
  }

  function populateLabelSelects(){
    function fillSelect(sel){
      if(!sel) return; sel.innerHTML='';
      for(var i=0;i<labelPalette.length;i++){
        var opt=document.createElement('option');
        opt.value=String(i);
        opt.textContent='Label ' + String(i);
        sel.appendChild(opt);
      }
    }
    fillSelect($("label-Video"));
    fillSelect($("label-VideoOnly"));
    fillSelect($("label-Audio"));
    fillSelect($("label-Images"));
    fillSelect($("label-Graphics"));
    fillSelect($("label-Sequences"));
    // restore saved values
    var s = normalizeSettings(loadSettings());
    if($('autoOnStartup')) $('autoOnStartup').checked = !!s.autoOnStartup;
    if($('debugMode')) $('debugMode').checked = !!s.debugMode;

    if(s.sortEnabledByType){
      for(var i=0;i<binOrder.length;i++){
        var t = binOrder[i];
        var ch = $('sort-' + t);
        if(ch && typeof s.sortEnabledByType[t] !== 'undefined') ch.checked = !!s.sortEnabledByType[t];
      }
    }

    if(s.binNames){
      for(var i=0;i<binOrder.length;i++){
        var bn = binOrder[i];
        var elb = $('bin-' + bn);
        if(elb && typeof s.binNames[bn] !== 'undefined') elb.value = String(s.binNames[bn] || '');
      }
    }

    renderRules(s.rules || []);

    if($("applyLabels")) $("applyLabels").checked = !!s.applyLabels;
    if(s.labels){
      for(var i=0;i<binOrder.length;i++){
        var id='label-'+binOrder[i]; var el=$(id); if(el && typeof s.labels[binOrder[i]]!== 'undefined'){ el.value=String(s.labels[binOrder[i]]); }
      }
    }
  }

  function scheduleAutoSort(force, newCount){
    if(!autoOn) return;
    if(force) autoForcePending = true;
    if(autoDebounceTimer){ clearTimeout(autoDebounceTimer); autoDebounceTimer=null; }
    autoDebounceTimer = setTimeout(function(){
      autoDebounceTimer = null;
      // Compare count only on event to avoid constant polling
      if(!autoOn) return;
      try{
        if(autoBusy && autoBusySince && (Date.now() - autoBusySince) > 15000){
          autoBusy = false;
          autoQueued = false;
          autoBusySince = 0;
        }
      }catch(_ab){}
      if(autoBusy){ autoQueued = true; return; }
      autoBusy = true;
      autoBusySince = Date.now();

      var last = (typeof lastCount === 'number' && !isNaN(lastCount)) ? lastCount : -1;
      var doForce = autoForcePending ? 1 : 0;
      autoForcePending = false;

      var script = '';
      script += 'var __ps_last=' + String(last) + ';';
      script += 'var __ps_curr=parseInt(projectSorter_projectNonBinCount()||"0",10);';
      script += 'var __ps_do=(' + String(doForce) + '===1) || (__ps_last>=0 && __ps_curr>__ps_last);';
      script += 'if(__ps_do){ projectSorter_labelNewItems(); projectSorter_sortAll(false); }';
      script += '"cnt="+__ps_curr+"|did="+(__ps_do?1:0);';

      setStatus('Auto: working');
      evalJSX(script, function(res){
        autoBusy = false;
        autoBusySince = 0;
        var out = (res && String(res)) || '';
        var m = /cnt=(\d+)\|did=(\d+)/.exec(out);
        var did = 0;
        if(m){
          var c = parseInt(m[1], 10);
          if(!isNaN(c)) lastCount = c;
          did = parseInt(m[2], 10);
          if(isNaN(did)) did = 0;
        }
        if(did){ bumpFallbackFastWindow(2500); }
        if(autoOn){
          if(did){
            setStatus('Auto: idle');
          }else{
            setStatus('Auto: on');
          }
        }
        if(autoOn && autoQueued){
          autoQueued = false;
          scheduleAutoSort(false);
        }
      });
    }, 75);
  }

  function scheduleTimelineLabel(){
    if(!autoOn) return;
    if(tlLabelDebounceTimer){ clearTimeout(tlLabelDebounceTimer); tlLabelDebounceTimer=null; }
    tlLabelDebounceTimer = setTimeout(function(){
      tlLabelDebounceTimer = null;
      if(!autoOn) return;
      var now = Date.now();
      var minGap = 800;
      if(now - tlLabelLastAt < minGap){
        scheduleTimelineLabel();
        return;
      }
      try{
        if(tlLabelBusy && tlLabelBusySince && (Date.now() - tlLabelBusySince) > 12000){
          tlLabelBusy = false;
          tlLabelQueued = false;
          tlLabelBusySince = 0;
        }
      }catch(_tlw){}
      if(tlLabelBusy){ tlLabelQueued = true; return; }
      tlLabelBusy = true;
      tlLabelBusySince = Date.now();
      tlLabelLastAt = now;
      evalJSX('projectSorter_labelTimelineGraphics();', function(){
        tlLabelBusy = false;
        tlLabelBusySince = 0;
        if(autoOn && tlLabelQueued){ tlLabelQueued = false; scheduleTimelineLabel(); }
      });
    }, 140);
  }

  function bumpFallbackFastWindow(ms){
    var now = Date.now();
    fallbackFastEndsAt = Math.max(fallbackFastEndsAt, now + (ms||2000));
    // if we are currently slow, nudge it faster for quicker reaction
    fallbackDelayMs = Math.min(fallbackDelayMs, 300);
  }

  function startFallbackPolling(){
    if(!autoOn) return;
    if(fallbackPollTimer) return;

    // quick warm-up for better UX right after enabling auto
    bumpFallbackFastWindow(2500);

    var tick = function(){
      if(!autoOn){ fallbackPollTimer=null; return; }
      scheduleAutoSort(false);
      scheduleTimelineLabel();

      if(Date.now() < fallbackFastEndsAt){
        fallbackDelayMs = 300;
      }else{
        fallbackDelayMs = Math.min(Math.round(Math.max(fallbackDelayMs, 1200) * 1.6), 7000);
      }

      fallbackPollTimer = setTimeout(tick, fallbackDelayMs);
    };

    fallbackPollTimer = setTimeout(tick, fallbackDelayMs);
  }

  function stopFallbackPolling(){
    if(fallbackPollTimer){ clearTimeout(fallbackPollTimer); fallbackPollTimer=null; }
    fallbackDelayMs = 1200;
    fallbackFastEndsAt = 0;
  }

  function attachImportListeners(){
    var events=[
      'com.adobe.csxs.events.ImportCompleted',
      'com.adobe.csxs.events.ProjectPanel.ImportCompleted',
      'com.adobe.csxs.events.ProjectItemsAdded',
      'com.adobe.csxs.events.PremierePro.ProjectItemsAdded',
      'com.adobe.csxs.events.PremierePro.ProjectItemAdded',
      'com.adobe.csxs.events.PremierePro.ProjectChanged'
    ];
    var handler=function(){
      // label immediately (cheap due to JSX cache); schedule sort separately
      scheduleAutoSort(false);
      scheduleTimelineLabel();
      bumpFallbackFastWindow(2000);
    };
    for(var i=0;i<events.length;i++){
      try{ cs.addEventListener(events[i], handler); importListeners.push({evt:events[i], fn:handler}); }catch(e){}
    }
  }
  function detachImportListeners(){
    for(var i=0;i<importListeners.length;i++){
      try{ cs.removeEventListener(importListeners[i].evt, importListeners[i].fn); }catch(e){}
    }
    importListeners=[];
  }

  function toggleAuto(){
    autoOn=!autoOn; var btn=$("autoBtn"); if(btn) btn.setAttribute('aria-pressed', String(autoOn));
    if(autoOn){
      setStatus('Auto: on');
      attachImportListeners();
      scheduleAutoSort(true);
      scheduleTimelineLabel();
      // Reliable fallback for cases where Premiere doesn't emit CSXS events (e.g. Explorer -> timeline drag&drop)
      startFallbackPolling();
    }else{
      detachImportListeners();
      if(autoDebounceTimer){ clearTimeout(autoDebounceTimer); autoDebounceTimer=null; }
      stopFallbackPolling();
      if(tlLabelDebounceTimer){ clearTimeout(tlLabelDebounceTimer); tlLabelDebounceTimer=null; }
      tlLabelBusy = false; tlLabelQueued = false; tlLabelLastAt = 0; tlLabelBusySince = 0;
      autoBusy = false; autoQueued = false; autoForcePending = false; autoBusySince = 0;
      lastCount = null;
      setStatus('Auto: off');
    }
  }

  document.addEventListener('DOMContentLoaded', function(){
    var play=$("playBtn"), auto=$("autoBtn");
    var addRuleBtn=$("addRuleBtn");
    if(play) play.addEventListener('click', sortOnce);
    if(auto) auto.addEventListener('click', toggleAuto);
    populateLabelSelects();
    // bind settings change handlers
    var applyEl=$("applyLabels"); if(applyEl) applyEl.addEventListener('change', function(){ saveSettings(currentSettings()); pushConfigToJSX(); });
    var aos=$('autoOnStartup'); if(aos) aos.addEventListener('change', function(){ saveSettings(currentSettings()); pushConfigToJSX(); });
    var dbg=$('debugMode'); if(dbg) dbg.addEventListener('change', function(){ saveSettings(currentSettings()); pushConfigToJSX(); });
    for(var i=0;i<binOrder.length;i++){
      var ch=$('sort-'+binOrder[i]);
      if(ch) ch.addEventListener('change', function(){ saveSettings(currentSettings()); pushConfigToJSX(); });
    }
    if(addRuleBtn) addRuleBtn.addEventListener('click', function(){
      var s0 = normalizeSettings(loadSettings());
      s0.rules = s0.rules || [];
      s0.rules.push({ enabled:true, type:'Audio', keyword:'', targetBin:'', label:0 });
      saveSettings(s0);
      renderRules(s0.rules);
      pushConfigToJSX();
    });
    for(var i=0;i<binOrder.length;i++){
      var el=$("label-"+binOrder[i]); if(el) el.addEventListener('change', function(){ saveSettings(currentSettings()); pushConfigToJSX(); });
      var binEl=$('bin-'+binOrder[i]); if(binEl) binEl.addEventListener('input', function(){ saveSettings(currentSettings()); pushConfigToJSX(); });
    }
    // initial sync to JSX
    pushConfigToJSX();
    setStatus('Idle');

    // Auto start
    var s = normalizeSettings(loadSettings());
    if(s && s.autoOnStartup){
      if(!autoOn){
        toggleAuto();
      }
    }
  });
})();
