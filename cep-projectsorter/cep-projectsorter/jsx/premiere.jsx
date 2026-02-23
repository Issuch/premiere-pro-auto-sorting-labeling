// Project Sorter (CEP) ExtendScript for Premiere Pro
// Sorts root project items into bins: Video, Audio, Images, Graphics, Sequences

// Label config (shared across calls)
var __ps_applyLabels = false;
var __ps_labelByBin = { Video: 0, VideoOnly: 0, Audio: 0, Images: 0, Graphics: 0, Sequences: 0 };
var __ps_applyLabelByType = { Video:true, VideoOnly:true, Audio:true, Images:true, Graphics:true, Sequences:true };
var __ps_seenItems = {};
var __ps_seenSortItems = {};
var __ps_lastLabelByKey = {};

function __ps_keyForItem(item){
    try{ if(item && item.nodeId !== undefined) return "id:" + String(item.nodeId); }catch(e){}
    try{ if(item && item.projectItem && item.projectItem.nodeId !== undefined) return "pid:" + String(item.projectItem.nodeId); }catch(e){}
    try{ if(item && item.treePath !== undefined) return "tp:" + String(item.treePath); }catch(e){}
    try{ if(item && item.projectItem && item.projectItem.treePath !== undefined) return "ptp:" + String(item.projectItem.treePath); }catch(e){}
    try{ if(item && item.getMediaPath) return "mp:" + String(item.getMediaPath()||""); }catch(e){}
    try{ if(item && item.projectItem && item.projectItem.getMediaPath) return "pmp:" + String(item.projectItem.getMediaPath()||""); }catch(e){}
    try{ if(item && item.name !== undefined) return "nm:" + String(item.name||""); }catch(e){}
    return "";
}

function __ps_setColorLabelIfDifferent(item, ll){
    try{
        ll = parseInt(ll, 10);
        if(isNaN(ll)) return 0;
        var k = "";
        try{ k = __ps_keyForItem(item); }catch(_k0){ k = ""; }
        try{
            if(k && __ps_lastLabelByKey && __ps_lastLabelByKey[k] !== undefined && __ps_lastLabelByKey[k] === ll){
                return 0;
            }
        }catch(_kc){}
        var cur = null;
        try{ if(item && item.getColorLabel){ cur = parseInt(item.getColorLabel(), 10); } }catch(_g){ cur = null; }
        if(cur !== null && cur !== undefined && !isNaN(cur) && cur === ll){
            try{ if(k) __ps_lastLabelByKey[k] = ll; }catch(_ks1){}
            return 0;
        }
        try{
            if(item && item.setColorLabel){
                item.setColorLabel(ll);
                try{ if(k) __ps_lastLabelByKey[k] = ll; }catch(_ks2){}
                return 1;
            }
        }catch(_s){}
    }catch(e){}
    return 0;
}

// Sort config (shared across calls)
var __ps_binNameByType = { Video: "Video", VideoOnly: "VideoOnly", Audio: "Audio", Images: "Images", Graphics: "Graphics", Sequences: "Sequences" };
var __ps_audioNameFilterEnabled = false;
var __ps_audioNameKeyword = "";
var __ps_audioNameTargetBin = "";
var __ps_rules = [];
var __ps_folderRule = { enabled:false, type:'Any', folder:'', targetBin:'', applyLabel:true, label:0 };
var __ps_folderRules = [];
var __ps_sortEnabledByType = { Video:true, VideoOnly:true, Audio:true, Images:true, Graphics:true, Sequences:true };

function __ps_isRuleEnabledFlag(v){
    try{
        if(v === false) return false;
        if(v === 0) return false;
        if(v === '0') return false;
        if(v === 'false') return false;
        if(v === 'False') return false;
        if(v === 'FALSE') return false;
        return true;
    }catch(e){
        return true;
    }
}

function __ps_isSortEnabledFlag(v){
    try{
        if(v === false) return false;
        if(v === 0) return false;
        if(v === '0') return false;
        if(v === 'false') return false;
        if(v === 'False') return false;
        if(v === 'FALSE') return false;
        return true;
    }catch(e){
        return true;
    }
}

function __ps_itemHasAncestorBinNamed(item, folderName){
    try{
        var want = String(folderName || '');
        if(!want) return false;
        var wl = want.toLowerCase();
        var b = null;
        try{ b = item ? item.parentBin : null; }catch(_b0){ b = null; }
        while(b){
            try{
                var bn = String(b.name || '');
                if(bn){
                    var bnl = bn.toLowerCase();
                    if(bnl.indexOf(wl) >= 0) return true;
                }
            }catch(_bn){}
            try{ b = b.parentBin; }catch(_bp){ b = null; }
        }

        // Fallback: some project items (e.g. Adjustment Layers) may not expose a reliable parentBin chain.
        // Try matching against treePath which contains the full bin ancestry.
        try{
            var tp = '';
            try{ if(item && item.treePath !== undefined) tp = String(item.treePath||''); }catch(_tp0){ tp = ''; }
            if(!tp){
                try{ if(item && item.projectItem && item.projectItem.treePath !== undefined) tp = String(item.projectItem.treePath||''); }catch(_tp1){ tp = ''; }
            }
            if(tp){
                var tpl = tp.toLowerCase();
                if(tpl.indexOf(wl) >= 0) return true;
            }
        }catch(_tp2){}
    }catch(e){}
    return false;
}

function projectSorter_setLabelConfig(apply, video, videoOnly, audio, images, graphics, sequences, applyVideo, applyVideoOnly, applyAudio, applyImages, applyGraphics, applySequences){
    __ps_applyLabels = !!apply;
    __ps_labelByBin = { Video: parseInt(video||0,10), VideoOnly: parseInt(videoOnly||0,10), Audio: parseInt(audio||0,10), Images: parseInt(images||0,10), Graphics: parseInt(graphics||0,10), Sequences: parseInt(sequences||0,10) };
    __ps_applyLabelByType = {
        Video: (applyVideo === undefined) ? true : !!applyVideo,
        VideoOnly: (applyVideoOnly === undefined) ? true : !!applyVideoOnly,
        Audio: (applyAudio === undefined) ? true : !!applyAudio,
        Images: (applyImages === undefined) ? true : !!applyImages,
        Graphics: (applyGraphics === undefined) ? true : !!applyGraphics,
        Sequences: (applySequences === undefined) ? true : !!applySequences
    };
    return "OK";
}

function projectSorter_primeAutoCaches(){
    try{
        var root = app.project.rootItem;
        __ps_seenItems = {};
        __ps_seenSortItems = {};
        __ps_lastLabelByKey = {};
        var primed = 0;

        function keyOf(item){
            try{ if(item.nodeId !== undefined) return "id:" + String(item.nodeId); }catch(e){}
            try{ if(item.treePath !== undefined) return "tp:" + String(item.treePath); }catch(e){}
            try{ if(item.getMediaPath) return "mp:" + String(item.getMediaPath()||""); }catch(e){}
            try{ return "nm:" + String(item.name||"") + "|" + String(item.type||""); }catch(e){}
            return "";
        }

        function walk(bin){
            if(!bin || !bin.children) return;
            var snap = [];
            for(var i=0;i<bin.children.numItems;i++) snap.push(bin.children[i]);
            for(var j=0;j<snap.length;j++){
                var it = snap[j];
                if(!it) continue;
                if(it.type === 2){
                    walk(it);
                }else{
                    var key = keyOf(it);
                    if(key){
                        try{ __ps_seenItems[key] = 1; }catch(_a){}
                        try{ __ps_seenSortItems[key] = 1; }catch(_b){}
                        primed++;
                    }
                }
            }
        }

        walk(root);
        return primed.toString();
    }catch(e){
        return "0";
    }
}

function projectSorter_projectDigest(){
    try{
        var root = app.project.rootItem;
        var cnt = 0;
        var hash = 0;
        function addStr(s){
            try{
                s = String(s||'');
                for(var i=0;i<s.length;i++){
                    hash = ((hash * 31) + s.charCodeAt(i)) & 0x7fffffff;
                }
            }catch(_e){}
        }
        function walk(bin){
            if(!bin || !bin.children) return;
            var snap = [];
            for(var i=0;i<bin.children.numItems;i++) snap.push(bin.children[i]);
            for(var j=0;j<snap.length;j++){
                var it = snap[j];
                if(!it) continue;
                if(it.type === 2){
                    walk(it);
                }else{
                    cnt++;
                    try{ if(it.treePath !== undefined) addStr('tp:' + String(it.treePath)); }catch(_tp){}
                    try{ if(it.nodeId !== undefined) addStr('|id:' + String(it.nodeId)); }catch(_id){}
                    try{ addStr('|nm:' + String(it.name||'')); }catch(_nm){}
                }
            }
        }
        walk(root);
        return 'c=' + String(cnt) + ';h=' + String(hash);
    }catch(e){
        return 'c=0;h=0';
    }
}

function projectSorter_sortNewItems(conformFlag, maxNew){
    try{
        var root = app.project.rootItem;

        var maxN = -1;
        try{
            if(maxNew !== undefined && maxNew !== null){
                maxN = parseInt(maxNew, 10);
                if(isNaN(maxN)) maxN = -1;
            }
        }catch(_mn){ maxN = -1; }

        var binNames = ["Video","VideoOnly","Audio","Images","Graphics","Sequences"];
        var bins = {};

        function getOrCreateBin(name){
            for (var i=0;i<root.children.numItems;i++){
                var it = root.children[i];
                if (it && it.type === 2 && it.name === name){ return it; }
            }
            return root.createBin(name);
        }

        for (var b=0;b<binNames.length;b++){
            var bn = binNames[b];
            if(__ps_sortEnabledByType && __ps_sortEnabledByType[bn] === false){
                continue;
            }
            var actualName = (__ps_binNameByType && __ps_binNameByType[bn]) ? String(__ps_binNameByType[bn]) : bn;
            bins[bn] = getOrCreateBin(actualName);
        }

        function getOrCreateSubBin(parentBin, name){
            if(!parentBin || !parentBin.children || !name) return null;
            try{
                for (var i=0;i<parentBin.children.numItems;i++){
                    var it = parentBin.children[i];
                    if (it && it.type === 2 && it.name === name){ return it; }
                }
            }catch(e){}
            try{ return parentBin.createBin(name); }catch(_e2){ return null; }
        }

        function getOrCreateRootBin(name){
            if(!name) return null;
            try{
                for (var i=0;i<root.children.numItems;i++){
                    var it = root.children[i];
                    if (it && it.type === 2 && it.name === name){ return it; }
                }
            }catch(e){}
            try{ return root.createBin(name); }catch(_e3){ return null; }
        }

        function keyOf(item){
            try{ if(item.nodeId !== undefined) return "id:" + String(item.nodeId); }catch(e){}
            try{ if(item.treePath !== undefined) return "tp:" + String(item.treePath); }catch(e){}
            try{ if(item.getMediaPath) return "mp:" + String(item.getMediaPath()||""); }catch(e){}
            try{ return "nm:" + String(item.name||"") + "|" + String(item.type||""); }catch(e){}
            return "";
        }

        function isUnderTargetTopBin(item, targetName){
            try{
                var b = item.parentBin;
                while (b){
                    if (b.name === targetName && b.parentBin === root){
                        return true;
                    }
                    b = b.parentBin;
                }
            }catch(e){}
            return false;
        }

        var VIDEO_EXT = {".mov":1,".mp4":1,".m4v":1,".avi":1,".mxf":1,".mpg":1,".mpeg":1,".mkv":1,".wmv":1,".flv":1,".mts":1,".m2ts":1};
        var AUDIO_EXT = {".wav":1,".mp3":1,".aif":1,".aiff":1,".aac":1,".m4a":1,".ogg":1,".flac":1};
        var IMAGE_EXT = {".png":1,".jpg":1,".jpeg":1,".tif":1,".tiff":1,".psd":1,".gif":1,".bmp":1,".svg":1,".webp":1};
        var GRAPHICS_EXT = {".mogrt":1,".prproj":1};

        function extOf(name){
            var dot = name.lastIndexOf(".");
            if (dot < 0) return "";
            return name.substring(dot).toLowerCase();
        }

        function getOrCreateRootBin(name){
            if(!name) return null;
            for (var i=0;i<root.children.numItems;i++){
                var it = root.children[i];
                if (it && it.type === 2 && it.name === name){ return it; }
            }
            try{ return root.createBin(name); }catch(e){ return null; }
        }

        function isUnderTargetTopBin(item, targetName){
            try{
                var b = item.parentBin;
                while (b){
                    if (b.name === targetName && b.parentBin === root){
                        return true;
                    }
                    b = b.parentBin;
                }
            }catch(e){}
            return false;
        }

        // Apply folder rules with highest priority (across the whole project tree, including nested bins)
        try{
            var allItems = [];
            function collectItems(bin, out){
                if(!bin || !bin.children) return;
                var snap = [];
                for(var i=0;i<bin.children.numItems;i++) snap.push(bin.children[i]);
                for(var j=0;j<snap.length;j++){
                    var it = snap[j];
                    if(!it) continue;
                    if(it.type === 2) collectItems(it, out);
                    else out.push(it);
                }
            }
            collectItems(root, allItems);

            for(var ai=0; ai<allItems.length; ai++){
                var item0 = allItems[ai];
                if(!item0) continue;

                var target0 = null;
                if (item0.isSequence && item0.isSequence()) {
                    target0 = "Sequences";
                } else {
                    var ext0 = extOf(nameForExt(item0));
                    if (VIDEO_EXT[ext0]) target0 = isVideoOnlyItem(item0) ? "VideoOnly" : "Video";
                    else if (AUDIO_EXT[ext0]) target0 = "Audio";
                    else if (IMAGE_EXT[ext0]) target0 = "Images";
                    else if (GRAPHICS_EXT[ext0]) target0 = "Graphics";
                }

                var itemType0 = target0 ? target0 : 'Any';

                var frs0 = (__ps_folderRules && __ps_folderRules.length) ? __ps_folderRules : ((__ps_folderRule && __ps_folderRule.folder) ? [__ps_folderRule] : []);
                for(var fi0=0; fi0<frs0.length; fi0++){
                    var fr0 = frs0[fi0];
                    if(!fr0 || !__ps_isRuleEnabledFlag(fr0.enabled)) continue;
                    var fkw0 = String(fr0.folder || '');
                    if(!fkw0) continue;
                    var frType0 = String(fr0.type || 'Any');
                    if(frType0 !== 'Any' && frType0 !== itemType0) continue;
                    if(__ps_itemHasAncestorBinNamed(item0, fkw0)){
                        var ftgt0 = String(fr0.targetBin || '');
                        if(ftgt0 && __ps_isSortEnabledFlag(fr0.sortEnabled)){
                            var frb0 = getOrCreateRootBin(ftgt0);
                            if(frb0){
                                if(!isUnderTargetTopBin(item0, ftgt0)){
                                    try{ item0.moveBin(frb0); }catch(_mfr0){}
                                }
                            }
                        }
                        if(canRuleLabel(fr0)){
                            var fll0 = parseInt(fr0.label, 10);
                            if(!isNaN(fll0)){
                                __ps_setColorLabelIfDifferent(item0, fll0);
                            }
                        }
                        break;
                    }
                }
            }
        }catch(_frLegacy){}

        function basenameOfPath(p){
            try{
                var s = String(p||'');
                if(!s) return '';
                var a = s.lastIndexOf('/');
                var b = s.lastIndexOf('\\');
                var i = (a > b) ? a : b;
                return (i >= 0) ? s.substring(i+1) : s;
            }catch(e){
                return '';
            }
        }

        function mediaFileNameOfItem(item){
            try{
                if(item && item.getMediaPath){
                    return basenameOfPath(String(item.getMediaPath()||''));
                }
            }catch(e){}
            return '';
        }

        function nameForExt(item){
            try{
                var nm = String(item && item.name ? item.name : '');
                if(nm.lastIndexOf('.') >= 0) return nm;
                var mf = mediaFileNameOfItem(item);
                if(mf && mf.lastIndexOf('.') >= 0) return mf;
                return nm;
            }catch(e){
                return String(item && item.name ? item.name : '');
            }
        }

        function isVideoOnlyItem(item){
            try{
                try{
                    if(item && item.getProjectMetadata){
                        var md = String(item.getProjectMetadata()||'');
                        if(md){
                            if(md.indexOf('Video Only') >= 0) return true;
                            if(md.indexOf('Media Type') >= 0 || md.indexOf('MediaType') >= 0){
                                if(md.indexOf('>Video<') >= 0) return true;
                                if(md.indexOf('>Movie<') >= 0) return false;
                            }
                        }
                    }
                }catch(_m0){}
                if(!item || !item.getAudioChannelMapping) return false;
                var m = item.getAudioChannelMapping();
                if(!m) return false;
                var n = NaN;
                try{ if(m.audioClipsNumber !== undefined) n = parseInt(m.audioClipsNumber, 10); }catch(_a0){}
                try{ if(isNaN(n) && m.audioTracksNumber !== undefined) n = parseInt(m.audioTracksNumber, 10); }catch(_a1){}
                try{ if(isNaN(n) && m.numAudioTracks !== undefined) n = parseInt(m.numAudioTracks, 10); }catch(_a2){}
                try{ if(isNaN(n) && m.audioChannelsNumber !== undefined) n = parseInt(m.audioChannelsNumber, 10); }catch(_a3){}
                if(isNaN(n)) return false;
                return (n === 0);
            }catch(e){
                return false;
            }
        }

        function safeLower(s){ try{ return String(s||'').toLowerCase(); }catch(e){ return String(s||''); } }
        function safeUpper(s){ try{ return String(s||'').toUpperCase(); }catch(e){ return String(s||''); } }

        function keywordMatch(name, keyword){
            try{
                var n = String(name || '');
                var k = String(keyword || '');
                if(!k) return false;
                if(n.indexOf(k) >= 0) return true;
                try{
                    var nl = safeLower(n);
                    var kl = safeLower(k);
                    if(nl.indexOf(kl) >= 0) return true;
                }catch(_l){}
                try{
                    var nu = safeUpper(n);
                    var ku = safeUpper(k);
                    if(nu.indexOf(ku) >= 0) return true;
                }catch(_u){}
            }catch(e){}
            return false;
        }

        function keywordMatchItem(item, keyword){
            try{
                if(keywordMatch(String(item && item.name ? item.name : ''), keyword)) return true;
                var mf = mediaFileNameOfItem(item);
                if(mf && keywordMatch(mf, keyword)) return true;
            }catch(e){}
            return false;
        }

        function canLabel(t){
            if(conformFlag) return true;
            if(!__ps_applyLabels) return false;
            try{ if(t && __ps_applyLabelByType && __ps_applyLabelByType[t] === false) return false; }catch(_cl){}
            return true;
        }

        function canRuleLabel(rr){
            if(conformFlag) return true;
            if(!__ps_applyLabels) return false;
            try{ if(rr && rr.applyLabel === false) return false; }catch(_rl){}
            return true;
        }

        function labelForType(t){
            var v = NaN;
            try{ if(__ps_labelByBin && __ps_labelByBin[t] !== undefined) v = parseInt(__ps_labelByBin[t], 10); }catch(_a){ v = NaN; }
            if(isNaN(v)){
                try{ if(bins && bins[t] && bins[t].getColorLabel) v = parseInt(bins[t].getColorLabel(), 10); }catch(_b){ v = NaN; }
            }
            return v;
        }

        var newItems = [];
        var hitCap = 0;
        function collectNew(bin){
            if (!bin || !bin.children) return;
            var snap = [];
            for (var i=0;i<bin.children.numItems;i++){
                snap.push(bin.children[i]);
            }
            for (var j=0;j<snap.length;j++){
                if(maxN > 0 && newItems.length >= maxN){ hitCap = 1; return; }
                var it = snap[j];
                if (!it) continue;
                if (it.type === 2){
                    collectNew(it);
                } else {
                    var key = keyOf(it);
                    if(key && __ps_seenSortItems[key]) continue;
                    newItems.push(it);
                }
            }
        }

        collectNew(root);

        var moved = 0;
        for (var k=0;k<newItems.length;k++){
            var item = newItems[k];
            if (!item) continue;
            var key0 = keyOf(item);

            var labelLocked = false;

            var target = null;
            if (item.isSequence && item.isSequence()){
                target = "Sequences";
            } else {
                var ext = extOf(nameForExt(item));
                if (VIDEO_EXT[ext]) target = isVideoOnlyItem(item) ? "VideoOnly" : "Video";
                else if (AUDIO_EXT[ext]) target = "Audio";
                else if (IMAGE_EXT[ext]) target = "Images";
                else if (GRAPHICS_EXT[ext]) target = "Graphics";
            }

            var itemType = target ? target : 'Any';

            var folderDone = false;
            try{
                var frs = (__ps_folderRules && __ps_folderRules.length) ? __ps_folderRules : ((__ps_folderRule && __ps_folderRule.folder) ? [__ps_folderRule] : []);
                for(var fi=0; fi<frs.length; fi++){
                    var fr = frs[fi];
                    if(!fr || !__ps_isRuleEnabledFlag(fr.enabled)) continue;
                    var fkw = String(fr.folder || '');
                    if(!fkw) continue;
                    var frType = String(fr.type || 'Any');
                    if(frType !== 'Any' && frType !== itemType) continue;
                    if(__ps_itemHasAncestorBinNamed(item, fkw)){
                        var ftgt = String(fr.targetBin || '');
                        if(ftgt && __ps_isSortEnabledFlag(fr.sortEnabled)){
                            var frb = getOrCreateRootBin(ftgt);
                            if(frb){
                                if(!isUnderTargetTopBin(item, ftgt)){
                                    try{ item.moveBin(frb); moved++; }catch(_mfr0){}
                                }
                            }
                            // Folder rule sorting wins; do not run other sorting logic.
                            folderDone = true;
                        }
                        if(canRuleLabel(fr)){
                            var fll = parseInt(fr.label, 10);
                            if(!isNaN(fll)){
                                __ps_setColorLabelIfDifferent(item, fll);
                                labelLocked = true;
                            }
                        }
                        break;
                    }
                }
            }catch(_frx){}
            if(folderDone){
                if(key0){ __ps_seenSortItems[key0] = 1; }
                continue;
            }

            try{
                if(__ps_rules && __ps_rules.length){
                    for(var ri=0; ri<__ps_rules.length; ri++){
                        var rr = __ps_rules[ri];
                        if(!rr || !__ps_isRuleEnabledFlag(rr.enabled)) continue;
                        var rType = String(rr.type || 'Any');
                        if(rType !== 'Any' && rType !== itemType) continue;
                        var kw = String(rr.keyword || '');
                        if(!kw) continue;
                        if(!keywordMatchItem(item, kw)) continue;
                        var tgt = String(rr.targetBin || '');
                        if(tgt && __ps_isSortEnabledFlag(rr.sortEnabled)){
                            var rb = getOrCreateRootBin(tgt);
                            if(rb){
                                if(!isUnderTargetTopBin(item, tgt)){
                                    try{ item.moveBin(rb); moved++; }catch(_m0){}
                                }
                            }
                        }
                        if(canRuleLabel(rr)){
                            var ll = parseInt(rr.label, 10);
                            if(!isNaN(ll)){
                                __ps_setColorLabelIfDifferent(item, ll);
                                labelLocked = true;
                            }
                        }
                        // Skip default type-based routing only if the rule actually moved the item.
                        if(tgt && __ps_isSortEnabledFlag(rr.sortEnabled)){
                            target = null;
                        }
                        ri = __ps_rules.length;
                    }
                }
            }catch(_r1){}

            if(!target){
                if(key0){ __ps_seenSortItems[key0] = 1; }
                continue;
            }

            if(itemType === 'Any'){
                if(key0){ __ps_seenSortItems[key0] = 1; }
                continue;
            }

            if(__ps_sortEnabledByType && __ps_sortEnabledByType[target] === false){
                // Sorting disabled for this type: do not move, but still label if labeling is enabled.
                try{
                    if(conformFlag || __ps_applyLabels){
                        if(!labelLocked && canLabel(target)){
                            var lbl0 = labelForType(target);
                            __ps_setColorLabelIfDifferent(item, lbl0);
                        }
                    }
                }catch(_sl0){}
                if(key0){ __ps_seenSortItems[key0] = 1; }
                continue;
            }

            if(target === "Audio" && __ps_audioNameFilterEnabled && __ps_audioNameKeyword && __ps_audioNameTargetBin){
                try{
                    if(keywordMatchItem(item, __ps_audioNameKeyword)){
                        var sub = getOrCreateSubBin(bins["Audio"], __ps_audioNameTargetBin);
                        if(sub){
                            try{ item.moveBin(sub); moved++; }catch(_m){}
                            if (canLabel("Audio")){
                                if(!labelLocked){
                                    __ps_setColorLabelIfDifferent(item, labelForType("Audio"));
                                }
                            }
                            if(key0){ __ps_seenSortItems[key0] = 1; }
                            continue;
                        }
                    }
                }catch(_e0){}
            }

            if(!bins[target]){
                if(key0){ __ps_seenSortItems[key0] = 1; }
                continue;
            }

            if (isUnderTargetTopBin(item, String(bins[target].name))){
                if (canLabel(target)){
                    try{
                        var lbl0 = labelForType(target);
                        if(!isNaN(lbl0)){
                            __ps_setColorLabelIfDifferent(item, lbl0);
                        }
                    }catch(_lSk0){}
                }
                if(key0){ __ps_seenSortItems[key0] = 1; }
                continue;
            }

            try{
                item.moveBin(bins[target]);
                moved++;
                if (canLabel(target)){
                    var lbl = labelForType(target);
                    if(!labelLocked){
                        __ps_setColorLabelIfDifferent(item, lbl);
                    }
                }
            }catch(e){}

            if(key0){ __ps_seenSortItems[key0] = 1; }
        }

        return "OK|new=" + newItems.length + "|moved=" + moved + "|cap=" + hitCap;
    }catch(err){
        return "ERR:" + err;
    }
}

function projectSorter_getLabelNames(){
    try{
        var wanted = 16;
        var names = [];

        function safeStr(v){ try{ return String(v||''); }catch(e){ return ''; } }
        function joinPath(a,b){
            a = safeStr(a);
            b = safeStr(b);
            if(!a) return b;
            if(!b) return a;
            var sep = (a.indexOf('\\') >= 0) ? '\\' : '/';
            if(a.charAt(a.length-1) === '/' || a.charAt(a.length-1) === '\\') return a + b;
            return a + sep + b;
        }

        function findLabelFileInFolder(folderPath, depth){
            try{
                var folder = new Folder(folderPath);
                if(!folder.exists) return null;
                var files = folder.getFiles();
                for(var i=0;i<files.length;i++){
                    var f = files[i];
                    if(!f) continue;
                    try{
                        if(f instanceof File){
                            var n = safeStr(f.name);
                            if(n.toLowerCase() === 'label colors and names.prsl') return f;
                        }
                    }catch(_f){}
                }
                if(depth <= 0) return null;
                for(var j=0;j<files.length;j++){
                    var d = files[j];
                    try{
                        if(d instanceof Folder){
                            var found = findLabelFileInFolder(d.fsName, depth-1);
                            if(found) return found;
                        }
                    }catch(_d){}
                }
            }catch(e){}
            return null;
        }

        function readTextFile(f){
            try{
                if(!f || !f.exists) return '';
                f.encoding = 'UTF-8';
                f.lineFeed = 'unix';
                if(!f.open('r')) return '';
                var t = f.read();
                f.close();
                return safeStr(t);
            }catch(e){
                try{ if(f && f.close) f.close(); }catch(_c){}
                return '';
            }
        }

        function extractNamesFromText(t){
            var out = [];
            try{
                var s = safeStr(t);
                if(!s) return out;
                var re1 = /<string>([^<]+)<\/string>/gi;
                var m1;
                while((m1 = re1.exec(s)) && out.length < wanted){
                    var v1 = safeStr(m1[1]).replace(/^\s+|\s+$/g,'');
                    if(v1) out.push(v1);
                }
                if(out.length === 0){
                    var re2 = /label[^\n\r\"]{0,50}\"([^\"]+)\"/gi;
                    var m2;
                    while((m2 = re2.exec(s)) && out.length < wanted){
                        var v2 = safeStr(m2[1]).replace(/^\s+|\s+$/g,'');
                        if(v2) out.push(v2);
                    }
                }
                return out;
            }catch(e){}
            return out;
        }

        var basePaths = [];
        try{ basePaths.push(safeStr(app.getPProPrefPath())); }catch(_p0){}
        try{ basePaths.push(safeStr(app.getAppPrefPath())); }catch(_p1){}
        try{ basePaths.push(safeStr(app.getPProSystemPrefPath())); }catch(_p2){}

        var labelFile = null;
        for(var bp=0; bp<basePaths.length; bp++){
            var p = basePaths[bp];
            if(!p) continue;
            try{
                var direct = new File(joinPath(p, 'Label Colors and Names.prsl'));
                if(direct.exists){ labelFile = direct; break; }
            }catch(_d0){}
            labelFile = findLabelFileInFolder(p, 3);
            if(labelFile) break;
        }

        var text = readTextFile(labelFile);
        names = extractNamesFromText(text);
        if(!names || names.length === 0){
            return 'ERR:NoLabelNames';
        }
        while(names.length < wanted){
            names.push(names[names.length-1]);
        }
        return JSON.stringify(names.slice(0, wanted));
    }catch(e){
        return 'ERR:' + e;
    }
}

function projectSorter_getLabelPalette(){
    try{
        var wanted = 16;
        var pairs = [];

        function safeStr(v){ try{ return String(v||''); }catch(e){ return ''; } }
        function joinPath(a,b){
            a = safeStr(a);
            b = safeStr(b);
            if(!a) return b;
            if(!b) return a;
            var sep = (a.indexOf('\\') >= 0) ? '\\' : '/';
            if(a.charAt(a.length-1) === '/' || a.charAt(a.length-1) === '\\') return a + b;
            return a + sep + b;
        }

        function findLabelFileInFolder(folderPath, depth){
            try{
                var folder = new Folder(folderPath);
                if(!folder.exists) return null;
                var files = folder.getFiles();
                for(var i=0;i<files.length;i++){
                    var f = files[i];
                    if(!f) continue;
                    try{
                        if(f instanceof File){
                            var n = safeStr(f.name);
                            if(n.toLowerCase() === 'label colors and names.prsl') return f;
                        }
                    }catch(_f){}
                }
                if(depth <= 0) return null;
                for(var j=0;j<files.length;j++){
                    var d = files[j];
                    try{
                        if(d instanceof Folder){
                            var found = findLabelFileInFolder(d.fsName, depth-1);
                            if(found) return found;
                        }
                    }catch(_d){}
                }
            }catch(e){}
            return null;
        }

        function readTextFile(f){
            try{
                if(!f || !f.exists) return '';
                f.encoding = 'UTF-8';
                f.lineFeed = 'unix';
                if(!f.open('r')) return '';
                var t = f.read();
                f.close();
                return safeStr(t);
            }catch(e){
                try{ if(f && f.close) f.close(); }catch(_c){}
                return '';
            }
        }

        function extractPairs(t){
            var out = [];
            try{
                var s = safeStr(t);
                if(!s) return out;
                var reName = /<string>([^<]+)<\/string>/gi;
                var m;
                while((m = reName.exec(s)) && out.length < wanted){
                    var ctxStart = Math.max(0, m.index - 220);
                    var ctxEnd = Math.min(s.length, m.index + 220);
                    var ctx = s.substring(ctxStart, ctxEnd).toLowerCase();
                    if(ctx.indexOf('label') < 0) continue;

                    var nm = safeStr(m[1]).replace(/^\s+|\s+$/g,'');
                    if(!nm) continue;
                    if(nm.length > 40) continue;
                    if(nm.indexOf('\\') >= 0 || nm.indexOf('/') >= 0) continue;

                    var start = reName.lastIndex;
                    var end = Math.min(start + 3000, s.length);
                    var chunk = s.substring(start, end);

                    var hex = null;
                    var mh = /#([0-9a-fA-F]{6})/.exec(chunk);
                    if(mh && mh[1]){
                        hex = '#' + safeStr(mh[1]).toUpperCase();
                    }else{
                        var mx = /0x([0-9a-fA-F]{6})/.exec(chunk);
                        if(mx && mx[1]) hex = '#' + safeStr(mx[1]).toUpperCase();
                    }

                    if(!hex){
                        var mi = /\b(\d{1,3})\b[^\d]{1,80}\b(\d{1,3})\b[^\d]{1,80}\b(\d{1,3})\b/.exec(chunk);
                        if(mi){
                            var r0 = parseInt(mi[1],10);
                            var g0 = parseInt(mi[2],10);
                            var b0 = parseInt(mi[3],10);
                            if(!(isNaN(r0)||isNaN(g0)||isNaN(b0)) && r0>=0 && r0<=255 && g0>=0 && g0<=255 && b0>=0 && b0<=255){
                                var rr = ('0' + r0.toString(16)).slice(-2);
                                var gg = ('0' + g0.toString(16)).slice(-2);
                                var bb = ('0' + b0.toString(16)).slice(-2);
                                hex = ('#' + rr + gg + bb).toUpperCase();
                            }
                        }
                    }

                    if(!hex){
                        var mf = /\b(0(?:\.\d+)?|1(?:\.0+)?)\b[^\d]{1,80}\b(0(?:\.\d+)?|1(?:\.0+)?)\b[^\d]{1,80}\b(0(?:\.\d+)?|1(?:\.0+)?)\b/.exec(chunk);
                        if(mf){
                            var rf = parseFloat(mf[1]);
                            var gf = parseFloat(mf[2]);
                            var bf = parseFloat(mf[3]);
                            if(!(isNaN(rf)||isNaN(gf)||isNaN(bf)) && rf>=0 && rf<=1 && gf>=0 && gf<=1 && bf>=0 && bf<=1){
                                var r1 = Math.round(rf * 255);
                                var g1 = Math.round(gf * 255);
                                var b1 = Math.round(bf * 255);
                                var rr1 = ('0' + r1.toString(16)).slice(-2);
                                var gg1 = ('0' + g1.toString(16)).slice(-2);
                                var bb1 = ('0' + b1.toString(16)).slice(-2);
                                hex = ('#' + rr1 + gg1 + bb1).toUpperCase();
                            }
                        }
                    }
                    if(!hex) continue;

                    out.push({ name: nm, hex: hex });
                }
            }catch(e){}
            return out;
        }

        var basePaths = [];
        try{ basePaths.push(safeStr(app.getPProPrefPath())); }catch(_p0){}
        try{ basePaths.push(safeStr(app.getAppPrefPath())); }catch(_p1){}
        try{ basePaths.push(safeStr(app.getPProSystemPrefPath())); }catch(_p2){}

        var labelFile = null;
        for(var bp=0; bp<basePaths.length; bp++){
            var p = basePaths[bp];
            if(!p) continue;
            try{
                var direct = new File(joinPath(p, 'Label Colors and Names.prsl'));
                if(direct.exists){ labelFile = direct; break; }
            }catch(_d0){}
            labelFile = findLabelFileInFolder(p, 3);
            if(labelFile) break;
        }

        var text = readTextFile(labelFile);
        pairs = extractPairs(text);
        if(!pairs || pairs.length === 0) return 'ERR:NoLabelPalette';
        while(pairs.length < wanted){ pairs.push(pairs[pairs.length-1]); }
        return JSON.stringify(pairs.slice(0, wanted));
    }catch(e){
        return 'ERR:' + e;
    }
}

function projectSorter_setRulesConfig(rulesJsonString){
    try{
        // Accept array/object directly OR JSON string (single/double encoded).
        // This avoids fragile evalScript double-encoding.
        if(rulesJsonString && typeof rulesJsonString !== 'string'){
            // If it's already an array-like object, take it.
            if(rulesJsonString.length !== undefined){
                __ps_rules = rulesJsonString;
                return "OK";
            }
        }
        // String path
        var s = String(rulesJsonString || "[]");
        var parsed = null;
        try{ parsed = JSON.parse(s); }catch(_e1){ parsed = null; }
        if(typeof parsed === 'string'){
            try{ parsed = JSON.parse(parsed); }catch(_e2){ parsed = []; }
        }
        if(!(parsed && parsed.length !== undefined)) parsed = [];
        __ps_rules = parsed;
        return "OK";
    }catch(e){
        __ps_rules = [];
        return "ERR";
    }
}

function projectSorter_setFolderRulesConfig(folderRulesJsonString){
    try{
        if(folderRulesJsonString && typeof folderRulesJsonString !== 'string'){
            if(folderRulesJsonString.length !== undefined){
                __ps_folderRules = folderRulesJsonString;
                try{ __ps_folderRule = (__ps_folderRules && __ps_folderRules.length) ? __ps_folderRules[0] : { enabled:false, type:'Any', folder:'', targetBin:'', applyLabel:true, label:0 }; }catch(_fr0){}
                return "OK";
            }
        }
        var s = String(folderRulesJsonString || "[]");
        var parsed = null;
        try{ parsed = JSON.parse(s); }catch(_e1){ parsed = null; }
        if(typeof parsed === 'string'){
            try{ parsed = JSON.parse(parsed); }catch(_e2){ parsed = []; }
        }
        if(!(parsed && parsed.length !== undefined)) parsed = [];
        __ps_folderRules = parsed;
        try{ __ps_folderRule = (__ps_folderRules && __ps_folderRules.length) ? __ps_folderRules[0] : { enabled:false, type:'Any', folder:'', targetBin:'', applyLabel:true, label:0 }; }catch(_fr1){}
        return "OK";
    }catch(e){
        __ps_folderRules = [];
        try{ __ps_folderRule = { enabled:false, type:'Any', folder:'', targetBin:'', applyLabel:true, label:0 }; }catch(_fr2){}
        return "ERR";
    }
}

function projectSorter_setFolderRuleConfig(enabled, type, folder, targetBin, applyLabel, label){
    try{
        __ps_folderRule = {
            enabled: !!enabled,
            type: String(type || 'Any'),
            folder: String(folder || ''),
            targetBin: String(targetBin || ''),
            applyLabel: (applyLabel === undefined) ? true : !!applyLabel,
            label: parseInt(label || 0, 10)
        };
        if(isNaN(__ps_folderRule.label)) __ps_folderRule.label = 0;
        __ps_folderRules = [__ps_folderRule];
        return "OK";
    }catch(e){
        try{ __ps_folderRule = { enabled:false, type:'Any', folder:'', targetBin:'', applyLabel:true, label:0 }; }catch(_e){}
        try{ __ps_folderRules = []; }catch(_e2){}
        return "ERR";
    }
}

function projectSorter_labelTimelineGraphics(){
    // Best-effort: label MOGRT/graphics clips on the active sequence.
    try{
        if(!__ps_applyLabels){ return "0"; }
        try{ if(__ps_applyLabelByType && __ps_applyLabelByType.Graphics === false) return "0"; }catch(_t0){}
        var seq = app.project.activeSequence;
        if(!seq) return "0";

        var lbl = parseInt(__ps_labelByBin.Graphics, 10);
        if(isNaN(lbl)) return "0";

        var labeled = 0;
        var vTracks = seq.videoTracks;
        if(!vTracks) return "0";

        for(var ti=0; ti<vTracks.numTracks; ti++){
            var tr = vTracks[ti];
            if(!tr || !tr.clips) continue;
            for(var ci=0; ci<tr.clips.numItems; ci++){
                var clip = tr.clips[ci];
                if(!clip) continue;
                // Attempt to detect MOGRT/graphics
                var nm = "";
                try{ nm = String(clip.name || ""); }catch(_e0){}

                var isGraphics = false;
                // Many generated items (titles/graphics) might not expose projectItem.
                try{
                    if(!clip.projectItem){
                        isGraphics = true;
                    }
                }catch(_ePi){}
                try{
                    if(clip.projectItem && clip.projectItem.name){
                        var pin = String(clip.projectItem.name || "");
                        if(pin.toLowerCase().indexOf('.mogrt') >= 0) isGraphics = true;
                    }
                }catch(_e1){}
                if(!isGraphics){
                    try{
                        if(clip.projectItem && clip.projectItem.getMediaPath){
                            var mp = String(clip.projectItem.getMediaPath()||"");
                            if(mp === ""){
                                // Generated items like titles often have no media path
                                isGraphics = true;
                            }
                        }
                    }catch(_e1b){}
                }
                if(!isGraphics){
                    var nml = nm.toLowerCase();
                    if(nml.indexOf('mogrt') >= 0 || nml.indexOf('graphic') >= 0) isGraphics = true;
                }

                if(!isGraphics) continue;
                try{
                    var did = false;
                    if(clip.setColorLabel){
                        try{ did = (__ps_setColorLabelIfDifferent(clip, lbl) ? true : false); }catch(_x){}
                    }
                    if(!did && clip.projectItem && clip.projectItem.setColorLabel){
                        try{ did = (__ps_setColorLabelIfDifferent(clip.projectItem, lbl) ? true : false); }catch(_y){}
                    }
                    if(did) labeled++;
                }catch(_e2){}
            }
        }
        return labeled.toString();
    }catch(e){
        return "0";
    }
}

function projectSorter_setSortConfig(videoBin, videoOnlyBin, audioBin, imagesBin, graphicsBin, sequencesBin, audioFilterEnabled, audioKeyword, audioTargetBin, sortVideo, sortVideoOnly, sortAudio, sortImages, sortGraphics, sortSequences){
    __ps_binNameByType = {
        Video: String(videoBin || "Video"),
        VideoOnly: String(videoOnlyBin || "VideoOnly"),
        Audio: String(audioBin || "Audio"),
        Images: String(imagesBin || "Images"),
        Graphics: String(graphicsBin || "Graphics"),
        Sequences: String(sequencesBin || "Sequences")
    };
    __ps_audioNameFilterEnabled = !!audioFilterEnabled;
    __ps_audioNameKeyword = String(audioKeyword || "");
    __ps_audioNameTargetBin = String(audioTargetBin || "");
    __ps_sortEnabledByType = {
        Video: (sortVideo === undefined) ? true : !!sortVideo,
        VideoOnly: (sortVideoOnly === undefined) ? true : !!sortVideoOnly,
        Audio: (sortAudio === undefined) ? true : !!sortAudio,
        Images: (sortImages === undefined) ? true : !!sortImages,
        Graphics: (sortGraphics === undefined) ? true : !!sortGraphics,
        Sequences: (sortSequences === undefined) ? true : !!sortSequences
    };
    return "OK";
}

function projectSorter_labelNewItems(){
    try{
        if(!__ps_applyLabels){ return "0"; }

        function canLabel(t){
            if(!__ps_applyLabels) return false;
            try{ if(t && __ps_applyLabelByType && __ps_applyLabelByType[t] === false) return false; }catch(_cl){}
            return true;
        }

        var root = app.project.rootItem;

        var VIDEO_EXT = {".mov":1,".mp4":1,".m4v":1,".avi":1,".mxf":1,".mpg":1,".mpeg":1,".mkv":1,".wmv":1,".flv":1,".mts":1,".m2ts":1};
        var AUDIO_EXT = {".wav":1,".mp3":1,".aif":1,".aiff":1,".aac":1,".m4a":1,".ogg":1,".flac":1};
        var IMAGE_EXT = {".png":1,".jpg":1,".jpeg":1,".tif":1,".tiff":1,".psd":1,".gif":1,".bmp":1,".svg":1,".webp":1};
        var GRAPHICS_EXT = {".mogrt":1,".prproj":1};

        function isVideoOnlyItem(item){
            try{
                try{
                    if(item && item.getProjectMetadata){
                        var md = String(item.getProjectMetadata()||'');
                        if(md){
                            if(md.indexOf('Video Only') >= 0) return true;
                            if(md.indexOf('Media Type') >= 0 || md.indexOf('MediaType') >= 0){
                                if(md.indexOf('>Video<') >= 0) return true;
                                if(md.indexOf('>Movie<') >= 0) return false;
                            }
                        }
                    }
                }catch(_m0){}
                if(!item || !item.getAudioChannelMapping) return false;
                var m = item.getAudioChannelMapping();
                if(!m) return false;
                var n = NaN;
                try{ if(m.audioClipsNumber !== undefined) n = parseInt(m.audioClipsNumber, 10); }catch(_a0){}
                try{ if(isNaN(n) && m.audioTracksNumber !== undefined) n = parseInt(m.audioTracksNumber, 10); }catch(_a1){}
                try{ if(isNaN(n) && m.numAudioTracks !== undefined) n = parseInt(m.numAudioTracks, 10); }catch(_a2){}
                try{ if(isNaN(n) && m.audioChannelsNumber !== undefined) n = parseInt(m.audioChannelsNumber, 10); }catch(_a3){}
                if(isNaN(n)) return false;
                return (n === 0);
            }catch(e){
                return false;
            }
        }

        function extOf(name){
            var dot = name.lastIndexOf(".");
            if (dot < 0) return "";
            return name.substring(dot).toLowerCase();
        }

        function mediaFileNameOfItem(item){
            try{
                if(item && item.getMediaPath){
                    var p = String(item.getMediaPath()||'');
                    if(!p) return '';
                    var a = p.lastIndexOf('/');
                    var b = p.lastIndexOf('\\');
                    var i = (a > b) ? a : b;
                    return (i >= 0) ? p.substring(i+1) : p;
                }
            }catch(e){}
            return '';
        }

        function nameForExt(item){
            try{
                var nm = String(item && item.name ? item.name : '');
                if(nm.lastIndexOf('.') >= 0) return nm;
                var mf = mediaFileNameOfItem(item);
                if(mf && mf.lastIndexOf('.') >= 0) return mf;
                return nm;
            }catch(e){
                return String(item && item.name ? item.name : '');
            }
        }

        function keyOf(item){
            try{ if(item.nodeId !== undefined) return "id:" + String(item.nodeId); }catch(e){}
            try{ if(item.treePath !== undefined) return "tp:" + String(item.treePath); }catch(e){}
            try{ if(item.getMediaPath) return "mp:" + String(item.getMediaPath()||""); }catch(e){}
            try{ return "nm:" + String(item.name||"") + "|" + String(item.type||""); }catch(e){}
            return "";
        }

        function walk(bin, out){
            if(!bin || !bin.children) return;
            var snap = [];
            for(var i=0;i<bin.children.numItems;i++) snap.push(bin.children[i]);
            for(var j=0;j<snap.length;j++){
                var it = snap[j];
                if(!it) continue;
                if(it.type === 2){
                    walk(it, out);
                }else{
                    out.push(it);
                }
            }
        }

        var items = [];
        walk(root, items);

        function safeLower(s){ try{ return String(s||'').toLowerCase(); }catch(e){ return String(s||''); } }
        function safeUpper(s){ try{ return String(s||'').toUpperCase(); }catch(e){ return String(s||''); } }
        function basenameOfPath(p){
            try{
                var s = String(p||'');
                if(!s) return '';
                var a = s.lastIndexOf('/');
                var b = s.lastIndexOf('\\');
                var i = (a > b) ? a : b;
                return (i >= 0) ? s.substring(i+1) : s;
            }catch(e){
                return '';
            }
        }
        // (mediaFileNameOfItem/nameForExt are already defined above for ext detection)

        function keywordMatch(name, keyword){
            try{
                var n = String(name || '');
                var k = String(keyword || '');
                if(!k) return false;
                if(n.indexOf(k) >= 0) return true;
                try{
                    var nl = safeLower(n);
                    var kl = safeLower(k);
                    if(nl.indexOf(kl) >= 0) return true;
                }catch(_l){}
                try{
                    var nu = safeUpper(n);
                    var ku = safeUpper(k);
                    if(nu.indexOf(ku) >= 0) return true;
                }catch(_u){}
            }catch(e){}
            return false;
        }

        function keywordMatchItem(item, keyword){
            try{
                if(keywordMatch(String(item && item.name ? item.name : ''), keyword)) return true;
                var mf = mediaFileNameOfItem(item);
                if(mf && keywordMatch(mf, keyword)) return true;
            }catch(e){}
            return false;
        }

        var labeled = 0;
        for(var k=0;k<items.length;k++){
            var item = items[k];
            if(!item) continue;

            var key = keyOf(item);
            if(key && __ps_seenItems[key]) continue;

            var target = null;
            if (item.isSequence && item.isSequence()){
                target = "Sequences";
            } else {
                var nm = String(item.name || "");
                var ext = extOf(nameForExt(item));
                if (VIDEO_EXT[ext]) target = isVideoOnlyItem(item) ? "VideoOnly" : "Video";
                else if (AUDIO_EXT[ext]) target = "Audio";
                else if (IMAGE_EXT[ext]) target = "Images";
                else if (GRAPHICS_EXT[ext]) target = "Graphics";
            }

            // Для правил типа Any нужно уметь работать даже когда тип не определён (расширение неизвестно).
            var itemType = target ? target : 'Any';

            // Folder rule has highest priority for labeling.
            var ruleLabel = null;
            var ruleApply = false;
            var folderMatched = false;
            try{
                var frs = (__ps_folderRules && __ps_folderRules.length) ? __ps_folderRules : ((__ps_folderRule && __ps_folderRule.folder) ? [__ps_folderRule] : []);
                for(var fi=0; fi<frs.length; fi++){
                    var fr = frs[fi];
                    if(!fr || fr.enabled === false) continue;
                    var fkw = String(fr.folder || '');
                    if(!fkw) continue;
                    var frType = String(fr.type || 'Any');
                    if(frType !== 'Any' && frType !== itemType) continue;
                    if(__ps_itemHasAncestorBinNamed(item, fkw)){
                        folderMatched = true;
                        if(fr.applyLabel === false){
                            ruleLabel = null;
                            ruleApply = false;
                        }else{
                            var fll = parseInt(fr.label, 10);
                            if(!isNaN(fll)){
                                ruleLabel = fll;
                                ruleApply = true;
                            }
                        }
                        break;
                    }
                }
            }catch(_frl){}

            // Rules (type + keyword) may override label (unless folder rule already matched)
            if(!folderMatched){
                try{
                    if(__ps_rules && __ps_rules.length){
                        for(var ri=0; ri<__ps_rules.length; ri++){
                            var rr = __ps_rules[ri];
                            if(!rr || !__ps_isRuleEnabledFlag(rr.enabled)) continue;
                            var rType = String(rr.type || 'Any');
                            if(rType !== 'Any' && rType !== itemType) continue;
                            var kw = String(rr.keyword || '');
                            if(!kw) continue;
                            if(!keywordMatchItem(item, kw)) continue;
                            if(rr.applyLabel === false){
                                ruleLabel = null;
                                ruleApply = false;
                            }else{
                                var ll = parseInt(rr.label, 10);
                                if(!isNaN(ll)){
                                    ruleLabel = ll;
                                    ruleApply = true;
                                }
                            }
                            break;
                        }
                    }
                }catch(_re){}
            }

            // Sorting can be disabled independently of labeling.

            if(target){
                try{
                    // For Audio we can optionally override based on filename keyword
                    if(target === "Audio" && __ps_audioNameFilterEnabled && __ps_audioNameKeyword && __ps_audioNameTargetBin){
                        var nml = String(item.name || "");
                        if(keywordMatchItem(item, __ps_audioNameKeyword)){
                            // label remains Audio label; routing is handled in sort
                        }
                    }
                    if(folderMatched){
                        if(ruleLabel !== null && ruleApply){
                            __ps_setColorLabelIfDifferent(item, ruleLabel);
                            labeled++;
                        }
                    }else{
                        if(ruleLabel !== null && ruleApply){
                            __ps_setColorLabelIfDifferent(item, ruleLabel);
                            labeled++;
                        }else if(canLabel(target)){
                            var lbl = parseInt(__ps_labelByBin[target], 10);
                            if(!isNaN(lbl)){
                                __ps_setColorLabelIfDifferent(item, lbl);
                                labeled++;
                            }
                        }
                    }
                }catch(e){}
            }

            if(key){ __ps_seenItems[key] = 1; }
        }

        return labeled.toString();
    }catch(e){
        return "0";
    }
}

function projectSorter_sort(conformFlag) {
    try {
        var root = app.project.rootItem;
        var binNames = ["Video","VideoOnly","Audio","Images","Graphics","Sequences"];
        var bins = {};

        function getOrCreateBin(name){
            for (var i=0;i<root.children.numItems;i++){
                var it = root.children[i];
                if (it && it.type === 2 && it.name === name){ return it; }
            }
            return root.createBin(name);
        }

        for (var b=0;b<binNames.length;b++){
            var bn = binNames[b];
            if(__ps_sortEnabledByType && __ps_sortEnabledByType[bn] === false){
                continue;
            }
            bins[bn] = getOrCreateBin(bn);
        }

        function canLabel(t){
            if(conformFlag) return true;
            if(!__ps_applyLabels) return false;
            try{ if(t && __ps_applyLabelByType && __ps_applyLabelByType[t] === false) return false; }catch(_cl){}
            return true;
        }

        function canRuleLabel(rr){
            if(conformFlag) return true;
            if(!__ps_applyLabels) return false;
            try{ if(rr && rr.applyLabel === false) return false; }catch(_rl){}
            return true;
        }

        function labelForType(t){
            var v = NaN;
            try{ if(__ps_labelByBin && __ps_labelByBin[t] !== undefined) v = parseInt(__ps_labelByBin[t], 10); }catch(_a){ v = NaN; }
            if(isNaN(v)){
                try{ if(bins && bins[t] && bins[t].getColorLabel) v = parseInt(bins[t].getColorLabel(), 10); }catch(_b){ v = NaN; }
            }
            return v;
        }

        var toMove = {"Video":[],"VideoOnly":[],"Audio":[],"Images":[],"Graphics":[],"Sequences":[]};

        // snapshot root items first to avoid index issues when moving
        var snapshot = [];
        for (var i=0;i<root.children.numItems;i++){
            snapshot.push(root.children[i]);
        }

        for (var j=0;j<snapshot.length;j++){
            var item = snapshot[j];
            if (!item) continue;
            // skip bins themselves
            if (item.type === 2) continue;

            var target = null;
            if (item.isSequence && item.isSequence()) {
                target = "Sequences";
            } else {
                var nm = String(item.name || "");
                var ext = extOf(nameForExt(item));
                if (VIDEO_EXT[ext]) target = isVideoOnlyItem(item) ? "VideoOnly" : "Video";
                else if (AUDIO_EXT[ext]) target = "Audio";
                else if (IMAGE_EXT[ext]) target = "Images";
                else if (GRAPHICS_EXT[ext]) target = "Graphics";
            }

            if (target && item.parentBin && item.parentBin.name !== target){
                toMove[target].push(item);
            } else if (target && !item.parentBin){
                toMove[target].push(item);
            }
        }

        function moveList(list, bin, t){
            for (var k=0;k<list.length;k++){
                try{ 
                    // If sorting disabled for this type, do not move but still label.
                    if(__ps_sortEnabledByType && __ps_sortEnabledByType[t] === false){
                        if (conformFlag || __ps_applyLabels){
                            if(canLabel(t)){
                                var lbl0 = labelForType(t);
                                __ps_setColorLabelIfDifferent(list[k], lbl0);
                            }
                        }
                    }else{
                        list[k].moveBin(bin);
                        if (conformFlag || __ps_applyLabels){
                            if(canLabel(t)){
                                var lbl = labelForType(t);
                                __ps_setColorLabelIfDifferent(list[k], lbl);
                            }
                        }
                    }
                }catch(e){}
            }
        }

        // Optionally set bin label colors and conform items
        if (conformFlag || __ps_applyLabels){
            try{ if(bins["Video"] && canLabel("Video")) bins["Video"].setColorLabel(__ps_labelByBin.Video); }catch(_){ }
            try{ if(bins["VideoOnly"] && canLabel("VideoOnly")) bins["VideoOnly"].setColorLabel(__ps_labelByBin.VideoOnly); }catch(_){ }
            try{ if(bins["Audio"] && canLabel("Audio")) bins["Audio"].setColorLabel(__ps_labelByBin.Audio); }catch(_){ }
            try{ if(bins["Images"] && canLabel("Images")) bins["Images"].setColorLabel(__ps_labelByBin.Images); }catch(_){ }
            try{ if(bins["Graphics"] && canLabel("Graphics")) bins["Graphics"].setColorLabel(__ps_labelByBin.Graphics); }catch(_){ }
            try{ if(bins["Sequences"] && canLabel("Sequences")) bins["Sequences"].setColorLabel(__ps_labelByBin.Sequences); }catch(_){ }
        }

        function getOrCreateSubBin(parentBin, name){
            if(!parentBin || !parentBin.children) return null;
            try{
                for (var i=0;i<parentBin.children.numItems;i++){
                    var it = parentBin.children[i];
                    if (it && it.type === 2 && it.name === name){ return it; }
                }
            }catch(e){}
            try{ return parentBin.createBin(name); }catch(_e2){ return null; }
        }

        function getOrCreateRootBin(name){
            if(!name) return null;
            try{
                for (var i=0;i<root.children.numItems;i++){
                    var it = root.children[i];
                    if (it && it.type === 2 && it.name === name){ return it; }
                }
            }catch(e){}
            try{ return root.createBin(name); }catch(_e3){ return null; }
        }

        function isUnderTopBin(item, topBinName){
            try{
                var b = item.parentBin;
                while(b){
                    if(b.name === topBinName && b.parentBin === root) return true;
                    b = b.parentBin;
                }
            }catch(e){}
            return false;
        }

        moveList(toMove.Video, bins["Video"], "Video");
        moveList(toMove.VideoOnly, bins["VideoOnly"], "VideoOnly");
        moveList(toMove.Audio, bins["Audio"], "Audio");
        moveList(toMove.Images, bins["Images"], "Images");
        moveList(toMove.Graphics, bins["Graphics"], "Graphics");
        moveList(toMove.Sequences, bins["Sequences"], "Sequences");

        return "OK";
    } catch (err){
        return "ERR:" + err;
    }
}

function projectSorter_rootNonBinCount(){
    try{
        var root = app.project.rootItem;
        var cnt = 0;
        for (var i=0;i<root.children.numItems;i++){
            var it = root.children[i];
            if (it && it.type !== 2){ cnt++; }
        }
        return cnt.toString();
    }catch(e){
        return "0";
    }
}

function projectSorter_projectNonBinCount(){
    try{
        var root = app.project.rootItem;
        function countIn(bin){
            var c = 0;
            if (!bin || !bin.children) return 0;
            for (var i=0;i<bin.children.numItems;i++){
                var it = bin.children[i];
                if (!it) continue;
                if (it.type === 2){
                    c += countIn(it);
                } else {
                    c++;
                }
            }
            return c;
        }
        return countIn(root).toString();
    }catch(e){
        return "0";
    }
}

function projectSorter_sortAll(conformFlag) {
    try {
        var root = app.project.rootItem;
        var binNames = ["Video","VideoOnly","Audio","Images","Graphics","Sequences"];
        var bins = {};

        var __ps_diag_rules = 0;
        var __ps_diag_matched = 0;
        var __ps_diag_moved = 0;
        try{ __ps_diag_rules = (__ps_rules && __ps_rules.length) ? __ps_rules.length : 0; }catch(_d0){ __ps_diag_rules = 0; }

        function getOrCreateBin(name){
            for (var i=0;i<root.children.numItems;i++){
                var it = root.children[i];
                if (it && it.type === 2 && it.name === name){ return it; }
            }
            return root.createBin(name);
        }

        for (var b=0;b<binNames.length;b++){
            var bn = binNames[b];
            if(__ps_sortEnabledByType && __ps_sortEnabledByType[bn] === false){
                continue;
            }
            var actualName = (__ps_binNameByType && __ps_binNameByType[bn]) ? String(__ps_binNameByType[bn]) : bn;
            bins[bn] = getOrCreateBin(actualName);
        }

        function getOrCreateSubBin(parentBin, name){
            if(!parentBin || !parentBin.children || !name) return null;
            try{
                for (var i=0;i<parentBin.children.numItems;i++){
                    var it = parentBin.children[i];
                    if (it && it.type === 2 && it.name === name){ return it; }
                }
            }catch(e){}
            try{ return parentBin.createBin(name); }catch(_e2){ return null; }
        }

        function getOrCreateRootBin(name){
            if(!name) return null;
            try{
                for (var i=0;i<root.children.numItems;i++){
                    var it = root.children[i];
                    if (it && it.type === 2 && it.name === name){ return it; }
                }
            }catch(e){}
            try{ return root.createBin(name); }catch(_e3){ return null; }
        }

        function isUnderTopBin(item, topBin){
            try{
                if(!item || !topBin) return false;
                var b = item.parentBin;
                while(b){
                    if(b === topBin) return true;
                    b = b.parentBin;
                }
            }catch(e){}
            return false;
        }

        var VIDEO_EXT = {".mov":1,".mp4":1,".m4v":1,".avi":1,".mxf":1,".mpg":1,".mpeg":1,".mkv":1,".wmv":1,".flv":1,".mts":1,".m2ts":1};
        var AUDIO_EXT = {".wav":1,".mp3":1,".aif":1,".aiff":1,".aac":1,".m4a":1,".ogg":1,".flac":1};
        var IMAGE_EXT = {".png":1,".jpg":1,".jpeg":1,".tif":1,".tiff":1,".psd":1,".gif":1,".bmp":1,".svg":1,".webp":1};
        var GRAPHICS_EXT = {".mogrt":1,".prproj":1};

        function isVideoOnlyItem(item){
            try{
                try{
                    if(item && item.getProjectMetadata){
                        var md = String(item.getProjectMetadata()||'');
                        if(md){
                            if(md.indexOf('Video Only') >= 0) return true;
                            if(md.indexOf('Media Type') >= 0 || md.indexOf('MediaType') >= 0){
                                if(md.indexOf('>Video<') >= 0) return true;
                                if(md.indexOf('>Movie<') >= 0) return false;
                            }
                        }
                    }
                }catch(_m0){}
                if(!item || !item.getAudioChannelMapping) return false;
                var m = item.getAudioChannelMapping();
                if(!m) return false;
                var n = NaN;
                try{ if(m.audioClipsNumber !== undefined) n = parseInt(m.audioClipsNumber, 10); }catch(_a0){}
                try{ if(isNaN(n) && m.audioTracksNumber !== undefined) n = parseInt(m.audioTracksNumber, 10); }catch(_a1){}
                try{ if(isNaN(n) && m.numAudioTracks !== undefined) n = parseInt(m.numAudioTracks, 10); }catch(_a2){}
                try{ if(isNaN(n) && m.audioChannelsNumber !== undefined) n = parseInt(m.audioChannelsNumber, 10); }catch(_a3){}
                if(isNaN(n)) return false;
                return (n === 0);
            }catch(e){
                return false;
            }
        }

        function extOf(name){
            var dot = name.lastIndexOf(".");
            if (dot < 0) return "";
            return name.substring(dot).toLowerCase();
        }

        function collectItems(bin, out){
            if (!bin || !bin.children) return;
            var snap = [];
            for (var i=0;i<bin.children.numItems;i++){
                snap.push(bin.children[i]);
            }
            for (var j=0;j<snap.length;j++){
                var it = snap[j];
                if (!it) continue;
                if (it.type === 2){
                    collectItems(it, out);
                } else {
                    out.push(it);
                }
            }
        }

        var items = [];
        collectItems(root, items);

        function safeLower(s){ try{ return String(s||'').toLowerCase(); }catch(e){ return String(s||''); } }
        function safeUpper(s){ try{ return String(s||'').toUpperCase(); }catch(e){ return String(s||''); } }
        function basenameOfPath(p){
            try{
                var s = String(p||'');
                if(!s) return '';
                var a = s.lastIndexOf('/');
                var b = s.lastIndexOf('\\');
                var i = (a > b) ? a : b;
                return (i >= 0) ? s.substring(i+1) : s;
            }catch(e){
                return '';
            }
        }
        function mediaFileNameOfItem(item){
            try{
                if(item && item.getMediaPath){
                    return basenameOfPath(String(item.getMediaPath()||''));
                }
            }catch(e){}
            return '';
        }

        function nameForExt(item){
            try{
                var nm = String(item && item.name ? item.name : '');
                if(nm.lastIndexOf('.') >= 0) return nm;
                var mf = mediaFileNameOfItem(item);
                if(mf && mf.lastIndexOf('.') >= 0) return mf;
                return nm;
            }catch(e){
                return String(item && item.name ? item.name : '');
            }
        }

        function keywordMatch(name, keyword){
            try{
                var n = String(name || '');
                var k = String(keyword || '');
                if(!k) return false;
                if(n.indexOf(k) >= 0) return true;
                try{
                    var nl = safeLower(n);
                    var kl = safeLower(k);
                    if(nl.indexOf(kl) >= 0) return true;
                }catch(_l){}
                try{
                    var nu = safeUpper(n);
                    var ku = safeUpper(k);
                    if(nu.indexOf(ku) >= 0) return true;
                }catch(_u){}
            }catch(e){}
            return false;
        }

        function keywordMatchItem(item, keyword){
            try{
                if(keywordMatch(String(item && item.name ? item.name : ''), keyword)) return true;
                var mf = mediaFileNameOfItem(item);
                if(mf && keywordMatch(mf, keyword)) return true;
            }catch(e){}
            return false;
        }

        function canLabel(t){
            if(conformFlag) return true;
            if(!__ps_applyLabels) return false;
            try{ if(t && __ps_applyLabelByType && __ps_applyLabelByType[t] === false) return false; }catch(_cl){}
            return true;
        }

        function canRuleLabel(rr){
            if(conformFlag) return true;
            if(!__ps_applyLabels) return false;
            try{ if(rr && rr.applyLabel === false) return false; }catch(_rl){}
            return true;
        }

        function labelForType(t){
            var v = NaN;
            try{ if(__ps_labelByBin && __ps_labelByBin[t] !== undefined) v = parseInt(__ps_labelByBin[t], 10); }catch(_a){ v = NaN; }
            if(isNaN(v)){
                try{ if(bins && bins[t] && bins[t].getColorLabel) v = parseInt(bins[t].getColorLabel(), 10); }catch(_b){ v = NaN; }
            }
            return v;
        }

        if (conformFlag || __ps_applyLabels){
            try{ if(bins["Video"] && canLabel("Video")) bins["Video"].setColorLabel(__ps_labelByBin.Video); }catch(_){ }
            try{ if(bins["VideoOnly"] && canLabel("VideoOnly")) bins["VideoOnly"].setColorLabel(__ps_labelByBin.VideoOnly); }catch(_){ }
            try{ if(bins["Audio"] && canLabel("Audio")) bins["Audio"].setColorLabel(__ps_labelByBin.Audio); }catch(_){ }
            try{ if(bins["Images"] && canLabel("Images")) bins["Images"].setColorLabel(__ps_labelByBin.Images); }catch(_){ }
            try{ if(bins["Graphics"] && canLabel("Graphics")) bins["Graphics"].setColorLabel(__ps_labelByBin.Graphics); }catch(_){ }
            try{ if(bins["Sequences"] && canLabel("Sequences")) bins["Sequences"].setColorLabel(__ps_labelByBin.Sequences); }catch(_){ }
        }

        function isUnderTargetTopBin(item, targetName){
            try{
                var b = item.parentBin;
                while (b){
                    if (b.name === targetName && b.parentBin === root){
                        return true;
                    }
                    b = b.parentBin;
                }
            }catch(e){}
            return false;
        }

        for (var k=0;k<items.length;k++){
            var item = items[k];
            if (!item) continue;

            var labelLocked = false;

            var target = null;
            if (item.isSequence && item.isSequence()){
                target = "Sequences";
            } else {
                var nm = String(item.name || "");
                var ext = extOf(nameForExt(item));
                if (VIDEO_EXT[ext]) target = isVideoOnlyItem(item) ? "VideoOnly" : "Video";
                else if (AUDIO_EXT[ext]) target = "Audio";
                else if (IMAGE_EXT[ext]) target = "Images";
                else if (GRAPHICS_EXT[ext]) target = "Graphics";
            }

            // Для правил типа Any нужно уметь работать даже когда тип не определён (расширение неизвестно).
            var itemType = target ? target : 'Any';

            var folderDone = false;
            try{
                var frs = (__ps_folderRules && __ps_folderRules.length) ? __ps_folderRules : ((__ps_folderRule && __ps_folderRule.folder) ? [__ps_folderRule] : []);
                for(var fi=0; fi<frs.length; fi++){
                    var fr = frs[fi];
                    if(!fr || fr.enabled === false) continue;
                    var fkw = String(fr.folder || '');
                    if(!fkw) continue;
                    var frType = String(fr.type || 'Any');
                    if(frType !== 'Any' && frType !== itemType) continue;
                    if(__ps_itemHasAncestorBinNamed(item, fkw)){
                        __ps_diag_matched++;
                        var ftgt = String(fr.targetBin || '');
                        if(ftgt && __ps_isSortEnabledFlag(fr.sortEnabled)){
                            var frb = getOrCreateRootBin(ftgt);
                            if(frb){
                                if(!isUnderTargetTopBin(item, ftgt)){
                                    try{ item.moveBin(frb); __ps_diag_moved++; }catch(_mfr0){}
                                }else{
                                    __ps_diag_moved++;
                                }
                            }
                            folderDone = true;
                        }
                        if(canRuleLabel(fr)){
                            var fll = parseInt(fr.label, 10);
                            if(!isNaN(fll)){
                                __ps_setColorLabelIfDifferent(item, fll);
                                labelLocked = true;
                            }
                        }
                        break;
                    }
                }
            }catch(_frx){}
            if(folderDone){
                continue;
            }

            // Apply rules first: move to custom root bin and set label.
            try{
                if(__ps_rules && __ps_rules.length){
                    for(var ri=0; ri<__ps_rules.length; ri++){
                        var rr = __ps_rules[ri];
                        if(!rr || !__ps_isRuleEnabledFlag(rr.enabled)) continue;
                        var rType = String(rr.type || 'Any');
                        if(rType !== 'Any' && rType !== itemType) continue;
                        var kw = String(rr.keyword || '');
                        if(!kw) continue;
                        if(!keywordMatchItem(item, kw)) continue;
                        __ps_diag_matched++;
                        var tgt = String(rr.targetBin || '');
                        // Route into a root-level bin (not nested under type bins)
                        if(tgt && __ps_isSortEnabledFlag(rr.sortEnabled)){
                            var rb = getOrCreateRootBin(tgt);
                            if(rb){
                                if(!isUnderTargetTopBin(item, tgt)){
                                    try{ item.moveBin(rb); __ps_diag_moved++; }catch(_m0){}
                                }else{
                                    __ps_diag_moved++;
                                }
                            }
                        }
                        if(canRuleLabel(rr)){
                            var ll = parseInt(rr.label, 10);
                            if(!isNaN(ll)){
                                __ps_setColorLabelIfDifferent(item, ll);
                                labelLocked = true;
                            }
                        }
                        // Rule matched; skip default type-based routing
                        ri = __ps_rules.length;
                        if(tgt && __ps_isSortEnabledFlag(rr.sortEnabled)){
                            target = null;
                        }
                    }
                }
            }catch(_r1){}
            if(!target) continue;

            // Если тип не определён (Any) и правило не сработало — пропускаем.
            if(itemType === 'Any'){
                continue;
            }

            // If disabled, skip ONLY default type-based sorting, but still apply labels.
            if(__ps_sortEnabledByType && __ps_sortEnabledByType[target] === false){
                try{
                    if(conformFlag || __ps_applyLabels){
                        if(!labelLocked && canLabel(target)){
                            var lbl0 = labelForType(target);
                            __ps_setColorLabelIfDifferent(item, lbl0);
                        }
                    }
                }catch(_sl1){}
                continue;
            }

            // Optional rule: Audio files with keyword go into a sub-bin under Audio
            if(target === "Audio" && __ps_audioNameFilterEnabled && __ps_audioNameKeyword && __ps_audioNameTargetBin){
                try{
                    var nm0 = String(item.name || "");
                    if(keywordMatchItem(item, __ps_audioNameKeyword)){
                        var sub = getOrCreateSubBin(bins["Audio"], __ps_audioNameTargetBin);
                        if(sub){
                            try{ item.moveBin(sub); __ps_diag_moved++; }catch(_m){}
                            if (canLabel("Audio")){
                                if(!labelLocked){
                                    __ps_setColorLabelIfDifferent(item, labelForType("Audio"));
                                }
                            }
                            continue;
                        }
                    }
                }catch(_e0){}
            }

            if(!bins[target]){
                continue;
            }

            // Already sorted (even if inside sub-bins of the target top-level bin)
            if (isUnderTargetTopBin(item, String(bins[target].name))){
                continue;
            }

            try{
                item.moveBin(bins[target]);
                __ps_diag_moved++;
                if (canLabel(target)){
                    var lbl = labelForType(target);
                    if(!labelLocked){
                        __ps_setColorLabelIfDifferent(item, lbl);
                    }
                }
            }catch(e){}
        }

        return "OK|rules=" + __ps_diag_rules + "|matched=" + __ps_diag_matched + "|moved=" + __ps_diag_moved;
    } catch (err){
        return "ERR:" + err;
    }
}
