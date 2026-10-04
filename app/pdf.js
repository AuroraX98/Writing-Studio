(function(root,factory){const font=typeof module==='object'&&module.exports?require('./vendor/pdf-font.js'):root.WritingPDFFont;const formatting=typeof module==='object'&&module.exports?require('./text-tools.js'):root.WritingTextTools;const api=factory(font,formatting);if(typeof module==='object'&&module.exports)module.exports=api;root.WritingPDF=api;})(globalThis,function(font,formatting){
 'use strict';
 const encoder=new TextEncoder();
 const bytes=s=>encoder.encode(s);
 const concatenate=parts=>{const output=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let offset=0;for(const p of parts){output.set(p,offset);offset+=p.length;}return output;};
 const fontBytes=()=>Uint8Array.from(atob(font.bytes),c=>c.charCodeAt(0));
 const normalize=s=>String(s??'').replace(/\r\n?/g,'\n').replace(/\t/g,'    ').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').normalize('NFC');
 function pdf(project){
  if(!font)throw new Error('The PDF font could not be loaded. Reopen the app and try again.');
  const title=normalize(project.title),chapters=(project.chapters||[]).map(c=>{const runs=formatting.runs(c.text,c.formats).map(run=>({...run,text:normalize(run.text)}));return {title:normalize(c.title),text:runs.map(run=>run.text).join(''),runs,leading:12*([1.4,1.7,2].includes(c.lineSpacing)?c.lineSpacing:1.7),alignment:['left','right','justify'].includes(c.alignment)?c.alignment:'left'};});
  const characters=new Set(Array.from(title+chapters.map(c=>c.title+c.text).join('')+'0123456789 '));characters.delete('\n');
  const unsupported=[...characters].filter(c=>!font.glyphs[c.codePointAt(0)]);
  if(unsupported.length)throw new Error('The PDF font cannot display '+unsupported.slice(0,5).map(c=>'“'+c+'”').join(', ')+'. Use Print / save as PDF for this manuscript.');
  const characterIDs=new Map([...characters].map((c,i)=>[c,i+1]));
  const encoded=s=>Array.from(s,c=>characterIDs.get(c).toString(16).padStart(4,'0')).join('');
  const width=(s,size)=>Array.from(s).reduce((n,c)=>n+font.glyphs[c.codePointAt(0)][1],0)*size/1000;
  const pageWidth=612,pageHeight=792,margin=72,columnWidth=468;
  const pages=[];let page,y;
  function newPage(){page=[];pages.push(page);y=pageHeight-margin-22;}
  function line(text,size=12,leading=19,alignment='left',stretch=false){
   if(y-leading<margin)newPage();
   if(text){
    const remaining=Math.max(0,columnWidth-width(text,size)),x=margin+(alignment==='right'?remaining:0);
    const spaces=(text.match(/ /g)||[]).length;
    let operation=`<${encoded(text)}> Tj`;
    if(alignment==='justify'&&stretch&&spaces&&remaining>0){
     const adjustment=-(remaining/spaces)*1000/size;
     const parts=text.split(' ');
     operation='['+parts.map((part,index)=>`<${encoded(part+(index<parts.length-1?' ':''))}>`+(index<parts.length-1?' '+adjustment.toFixed(6):'')).join(' ')+'] TJ';
    }
    page.push(`BT /F1 ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm ${operation} ET`);
   }
   y-=leading;
  }
  function wrapLine(text,size){
   if(!text)return [''];const lines=[];let current='';
   // Preserve explicit newlines and meaningful spaces; split overlong tokens.
   for(const token of text.match(/\S+| +/gu)||[]){
    if(width(current+token,size)<=columnWidth){current+=token;continue;}
    if(current.trim()){lines.push(current.trimEnd());current='';}
    if(!token.trim())continue;
    if(width(token,size)<=columnWidth){current=token;continue;}
    for(const c of token){if(width(current+c,size)>columnWidth&&current){lines.push(current);current='';}current+=c;}
   }
   if(current.trim()||!lines.length)lines.push(current.trimEnd());return lines;
  }
  function block(text,size=12,leading=19,alignment='left'){
   for(const sourceLine of text.split('\n')){
    const wrapped=wrapLine(sourceLine,size);
    wrapped.forEach((text,index)=>line(text,size,leading,alignment,index<wrapped.length-1));
   }
  }
  function styledBlock(chapter){
   const glyphs=chapter.runs.flatMap(run=>Array.from(run.text,char=>({char,bold:run.bold,italic:run.italic})));
   const italic=chapter.runs.some(run=>run.italic),limit=columnWidth-(italic?3:0);
   const glyphWidth=glyph=>width(glyph.char,12);
   const trimEnd=line=>{while(line.length&&line[line.length-1].char===' ')line.pop();return line;};
   function draw(glyphLine,stretch){
    if(y-chapter.leading<margin)newPage();
    const natural=glyphLine.reduce((sum,g)=>sum+glyphWidth(g),0),remaining=Math.max(0,limit-natural);
    const spaces=glyphLine.filter(g=>g.char===' ').length;
    const extra=chapter.alignment==='justify'&&stretch&&spaces?remaining/spaces:0;
    let x=margin+(chapter.alignment==='right'?remaining:0);
    // Stroke and shear synthesize emphasis from the embedded font; character advances stay unchanged.
    const groups=[];for(const glyph of glyphLine){const last=groups[groups.length-1];if(last&&last.bold===glyph.bold&&last.italic===glyph.italic)last.text+=glyph.char;else groups.push({text:glyph.char,bold:glyph.bold,italic:glyph.italic});}
    for(const group of groups){
     let operation=`<${encoded(group.text)}> Tj`;
     if(extra){const parts=group.text.split(' '),adjustment=(-extra*1000/12).toFixed(6);operation='['+parts.map((part,index)=>`<${encoded(part+(index<parts.length-1?' ':''))}>`+(index<parts.length-1?' '+adjustment:'')).join(' ')+'] TJ';}
     page.push(`q 0.12 0.12 0.12 RG 0.25 w BT /F1 12 Tf ${group.bold?2:0} Tr 1 0 ${group.italic?'0.20':'0'} 1 ${x.toFixed(4)} ${y.toFixed(2)} Tm ${operation} ET Q`);
     x+=width(group.text,12)+(group.text.match(/ /g)||[]).length*extra;
    }
    y-=chapter.leading;
   }
   const sourceLines=[[]];for(const glyph of glyphs){if(glyph.char==='\n')sourceLines.push([]);else sourceLines[sourceLines.length-1].push(glyph);}
   for(const source of sourceLines){
    const lines=[];let current=[],currentWidth=0;
    const tokens=[];for(const glyph of source){const last=tokens[tokens.length-1];if(last&&(last[0].char===' ')===(glyph.char===' '))last.push(glyph);else tokens.push([glyph]);}
    for(const token of tokens){const tokenWidth=token.reduce((sum,g)=>sum+glyphWidth(g),0);
     if(currentWidth+tokenWidth<=limit){current.push(...token);currentWidth+=tokenWidth;continue;}
     if(current.some(g=>g.char!==' ')){lines.push(trimEnd(current));current=[];currentWidth=0;}
     if(token.every(g=>g.char===' '))continue;
     for(const glyph of token){const advance=glyphWidth(glyph);if(currentWidth+advance>limit&&current.length){lines.push(current);current=[];currentWidth=0;}current.push(glyph);currentWidth+=advance;}
    }
    if(current.some(g=>g.char!==' ')||!lines.length)lines.push(trimEnd(current));
    lines.forEach((glyphLine,index)=>draw(glyphLine,index<lines.length-1));
   }
  }
  newPage();
  if(title){block(title,20,27);y-=22;}
  chapters.forEach((chapter,index)=>{
   if(index)newPage();
   const headingLines=wrapLine(chapter.title,17);
   const nextLines=chapter.text.trim()?2:0;
   if(y-(Math.min(headingLines.length,8)*24+nextLines*chapter.leading+14)<margin)newPage();
   for(const heading of headingLines)line(heading,17,24);
   y-=14;styledBlock(chapter);
  });
  pages.forEach((commands,i)=>{const number=String(i+1),x=(pageWidth-width(number,10))/2;commands.push(`BT /F1 10 Tf 1 0 0 1 ${x.toFixed(2)} 36 Tm <${encoded(number)}> Tj ET`);});
  const objects=[null];
  function reserve(){objects.push(null);return objects.length-1;}
  function put(id,value){objects[id]=typeof value==='string'?bytes(value):value;}
  function stream(dictionary,content){return concatenate([bytes('<< '+dictionary+' /Length '+content.length+' >>\nstream\n'),content,bytes('\nendstream')]);}
  const catalog=reserve(),pageTree=reserve(),type0=reserve(),cidFont=reserve(),descriptor=reserve(),fontFile=reserve(),cidMap=reserve(),unicodeMap=reserve();
  const ids=[...characterIDs.values()],map=new Uint8Array((ids.length+1)*2),widths=[];
  for(const [char,id]of characterIDs){const [glyph,advance]=font.glyphs[char.codePointAt(0)];map[id*2]=glyph>>8;map[id*2+1]=glyph&255;widths.push(advance);}
  const utf16Hex=s=>Array.from({length:s.length},(_,i)=>s.charCodeAt(i).toString(16).padStart(4,'0')).join('');
  const mappings=[...characterIDs].map(([char,id])=>'<'+id.toString(16).padStart(4,'0')+'> <'+utf16Hex(char)+'>');
  let cmap='/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /WritingDeskUnicode def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <ffff>\nendcodespacerange\n';
  for(let i=0;i<mappings.length;i+=100){const group=mappings.slice(i,i+100);cmap+=group.length+' beginbfchar\n'+group.join('\n')+'\nendbfchar\n';}
  cmap+='endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend';
  put(type0,`<< /Type /Font /Subtype /Type0 /BaseFont /DejaVuSerif /Encoding /Identity-H /DescendantFonts [${cidFont} 0 R] /ToUnicode ${unicodeMap} 0 R >>`);
  put(cidFont,`<< /Type /Font /Subtype /CIDFontType2 /BaseFont /DejaVuSerif /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${descriptor} 0 R /DW 1000 /W [1 [${widths.join(' ')}]] /CIDToGIDMap ${cidMap} 0 R >>`);
  put(descriptor,`<< /Type /FontDescriptor /FontName /DejaVuSerif /Flags 6 /FontBBox [${font.bbox.join(' ')}] /ItalicAngle 0 /Ascent ${font.ascent} /Descent ${font.descent} /CapHeight ${font.ascent} /StemV 80 /FontFile2 ${fontFile} 0 R >>`);
  const ttf=fontBytes();put(fontFile,stream('/Length1 '+ttf.length,ttf));put(cidMap,stream('',map));put(unicodeMap,stream('',bytes(cmap)));
  const pageIDs=[];
  for(const commands of pages){const id=reserve(),content=reserve();pageIDs.push(id);put(content,stream('',bytes('0.12 0.12 0.12 rg\n'+commands.join('\n'))));put(id,`<< /Type /Page /Parent ${pageTree} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${type0} 0 R >> >> /Contents ${content} 0 R >>`);}
  put(pageTree,`<< /Type /Pages /Kids [${pageIDs.map(id=>id+' 0 R').join(' ')}] /Count ${pageIDs.length} >>`);put(catalog,`<< /Type /Catalog /Pages ${pageTree} 0 R >>`);
  const chunks=[bytes('%PDF-1.7\n%WritingDesk\n')],offsets=[0];let length=chunks[0].length;
  for(let i=1;i<objects.length;i++){offsets.push(length);const chunk=concatenate([bytes(i+' 0 obj\n'),objects[i],bytes('\nendobj\n')]);chunks.push(chunk);length+=chunk.length;}
  const xref=length;chunks.push(bytes('xref\n0 '+objects.length+'\n0000000000 65535 f \n'+offsets.slice(1).map(offset=>String(offset).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size '+objects.length+' /Root '+catalog+' 0 R >>\nstartxref\n'+xref+'\n%%EOF\n'));
  return concatenate(chunks);
 }
 return {pdf};
});
