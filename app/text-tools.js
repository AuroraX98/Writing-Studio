(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.WritingTextTools=api;})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const MAX_SPANS=20000;
 const string=value=>String(value??'');
 function boundary(text,index,direction){index=Math.max(0,Math.min(text.length,Math.trunc(Number(index)||0)));if(index>0&&index<text.length&&/[\uD800-\uDBFF]/.test(text[index-1])&&/[\uDC00-\uDFFF]/.test(text[index]))index+=direction;return index;}
 function normalize(text,formats){
  text=string(text);const events=[];
  if(Array.isArray(formats)&&formats.length>MAX_SPANS)throw new RangeError('This draft has too many separate formatted selections. The maximum is '+MAX_SPANS+'.');
  for(const span of (Array.isArray(formats)?formats:[])){
   if(!span||!Number.isInteger(span.start)||!Number.isInteger(span.end)||span.start<0||span.end>text.length||span.start>=span.end)continue;
   const start=boundary(text,span.start,-1),end=boundary(text,span.end,1),bold=span.bold===true?1:0,italic=span.italic===true?1:0;
   if(bold||italic){events.push({at:start,bold,italic},{at:end,bold:-bold,italic:-italic});}
  }
  events.sort((a,b)=>a.at-b.at);const result=[];let bold=0,italic=0,previous=0,index=0;
  while(index<events.length){const at=events[index].at;if(at>previous&&(bold>0||italic>0)){const span={start:previous,end:at};if(bold>0)span.bold=true;if(italic>0)span.italic=true;const last=result[result.length-1];if(last&&last.end===span.start&&!!last.bold===!!span.bold&&!!last.italic===!!span.italic)last.end=span.end;else result.push(span);}
   while(index<events.length&&events[index].at===at){bold+=events[index].bold;italic+=events[index].italic;index++;}previous=at;
  }if(result.length>MAX_SPANS)throw new RangeError('This draft has too many separate formatted selections. The maximum is '+MAX_SPANS+'.');return result;
 }
 function runs(text,formats){text=string(text);const result=[];let position=0;for(const span of normalize(text,formats)){if(span.start>position)result.push({text:text.slice(position,span.start),start:position,end:span.start,bold:false,italic:false});result.push({text:text.slice(span.start,span.end),start:span.start,end:span.end,bold:!!span.bold,italic:!!span.italic});position=span.end;}if(position<text.length)result.push({text:text.slice(position),start:position,end:text.length,bold:false,italic:false});return result;}
 function toggle(text,formats,start,end,attribute){text=string(text);if(!['bold','italic'].includes(attribute))throw new TypeError('Choose bold or italic.');start=boundary(text,start,-1);end=boundary(text,end,1);if(end<=start)return normalize(text,formats);const segments=runs(text,formats);const enabled=!segments.filter(run=>run.end>start&&run.start<end).every(run=>run[attribute]);const spans=[];
  for(const run of segments){const edges=[run.start,...[start,end].filter(at=>at>run.start&&at<run.end),run.end].sort((a,b)=>a-b);for(let i=1;i<edges.length;i++){const span={start:edges[i-1],end:edges[i]};if(run.bold)span.bold=true;if(run.italic)span.italic=true;if(span.start>=start&&span.end<=end){if(enabled)span[attribute]=true;else delete span[attribute];}if(span.bold||span.italic)spans.push(span);}}
  return normalize(text,spans);
 }
 function edit(text,formats,start,end,replacement){text=string(text);replacement=string(replacement);start=boundary(text,start,-1);end=Math.max(start,boundary(text,end,1));const canonical=normalize(text,formats),next=text.slice(0,start)+replacement+text.slice(end),delta=replacement.length-(end-start),spans=[];
  for(const span of canonical){if(span.start<start){const left={...span,end:Math.min(span.end,start)};if(left.end>left.start)spans.push(left);}if(span.end>end){const right={...span,start:Math.max(span.start,end)+delta,end:span.end+delta};if(right.end>right.start)spans.push(right);}}
  if(replacement.length){const relevant=runs(text,canonical).filter(run=>end>start?run.end>start&&run.start<end:run.start<start&&run.end>start);const inherited={start,end:start+replacement.length};for(const key of ['bold','italic'])if(relevant.length&&relevant.every(run=>run[key]))inherited[key]=true;if(inherited.bold||inherited.italic)spans.push(inherited);}
  return {text:next,formats:normalize(next,spans)};
 }
 function rebase(oldText,newText,formats){oldText=string(oldText);newText=string(newText);let start=0;while(start<oldText.length&&start<newText.length&&oldText[start]===newText[start])start++;start=boundary(oldText,start,-1);let end=oldText.length,nextEnd=newText.length;while(end>start&&nextEnd>start&&oldText[end-1]===newText[nextEnd-1]){end--;nextEnd--;}end=boundary(oldText,end,1);nextEnd=boundary(newText,nextEnd,1);return edit(oldText,formats,start,end,newText.slice(start,nextEnd)).formats;}
 const escaped=text=>string(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
 function html(text,formats){return runs(text,formats).map(run=>{let content=escaped(run.text).replace(/\r\n?|\n/g,'<br>');if(run.italic)content='<em>'+content+'</em>';if(run.bold)content='<strong>'+content+'</strong>';return content;}).join('');}
 function markdown(text,formats){text=string(text);if(!normalize(text,formats).length)return text;const segments=runs(text,formats);const inlineHtml=segments.some((run,index)=>index>0&&!/\s/.test(text[run.start-1])&&!/\s/.test(text[run.start]));return segments.map(run=>run.text.split(/(\r\n|\r|\n)/).map(part=>{if(/^[\r\n]+$/.test(part))return part;const match=part.match(/^(\s*)(.*?)(\s*)$/s);let content=escaped(match[2]).replace(/([\\`*_{}\[\]()#+.!|>~-])/g,'\\$1');if(!content)return part;if(run.italic)content=inlineHtml?'<em>'+content+'</em>':'*'+content+'*';if(run.bold)content=inlineHtml?'<strong>'+content+'</strong>':'**'+content+'**';return match[1]+content+match[3];}).join('')).join('');}
 return {MAX_SPANS,normalize,toggle,edit,rebase,runs,html,markdown,boundary};
});
