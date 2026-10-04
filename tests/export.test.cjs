const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const WritingExport = require('../app/export.js');

const project = {
  title: 'Café & <Stars>',
  chapters: [
    { title: 'First — chapter', alignment: 'justify', text: 'Line one\nLine two\n\nSecond paragraph with “quotes”.' },
    { title: '第二章', alignment: 'right', text: 'A & B < C\nRésumé' }
  ]
};

assert.equal(
  WritingExport.text(project),
  'Café & <Stars>\n\nFirst — chapter\n\nLine one\nLine two\n\nSecond paragraph with “quotes”.\n\n第二章\n\nA & B < C\nRésumé'
);
assert.equal(
  WritingExport.markdown(project),
  '# Café & <Stars>\n\n## First — chapter\n\nLine one\nLine two\n\nSecond paragraph with “quotes”.\n\n## 第二章\n\nA & B < C\nRésumé'
);

const html = WritingExport.html(project);
assert.match(html, /<meta charset="utf-8">/);
assert.match(html, /Café &amp; &lt;Stars&gt;/);
assert.match(html, /<p style="text-align:justify;line-height:1\.7">Line one<br>Line two<\/p>/);
assert.match(html, /<p style="text-align:justify;line-height:1\.7">Second paragraph with “quotes”\.<\/p>/);
assert.match(html, /<p style="text-align:right;line-height:1\.7">A &amp; B &lt; C<br>Résumé<\/p>/);
assert.match(WritingExport.html({chapters:[{text:'Default'}]}), /text-align:left/);
assert.doesNotMatch(WritingExport.html({chapters:[{text:'Safe',alignment:'left; color:red'}]}), /color:red/);
assert.ok(html.indexOf('First — chapter') < html.indexOf('第二章'));
assert.match(html, /@media print[\s\S]*break-before:page/);
assert.doesNotMatch(html, /<script|https?:\/\//i);

const bytes = WritingExport.docx(project);
assert.ok(bytes instanceof Uint8Array);
assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), 'PK\u0003\u0004');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'writing-export-'));
try {
  const archive = path.join(tmp, 'manuscript.docx');
  fs.writeFileSync(archive, bytes);
  const verify = spawnSync('python3', ['-c', [
    'import sys, zipfile, xml.etree.ElementTree as ET',
    'z = zipfile.ZipFile(sys.argv[1])',
    'assert z.testzip() is None',
    'assert set(z.namelist()) == {"[Content_Types].xml", "_rels/.rels", "word/document.xml", "word/styles.xml", "word/_rels/document.xml.rels"}',
    'root = ET.fromstring(z.read("word/document.xml"))',
    'ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}',
    'paras = root.findall(".//w:body/w:p", ns)',
    'texts = ["".join(t.text or "" for t in p.findall(".//w:t", ns)) for p in paras]',
    'assert texts == ["Café & <Stars>", "First — chapter", "Line oneLine two", "Second paragraph with “quotes”.", "第二章", "A & B < CRésumé"]',
    'assert [paras[i].find("w:pPr/w:jc", ns).get("{" + ns["w"] + "}val") for i in [2,3,5]] == ["both", "both", "right"]',
    'headings = [p for p in paras if p.find("w:pPr/w:pStyle", ns) is not None and p.find("w:pPr/w:pStyle", ns).get("{" + ns["w"] + "}val") == "Heading1"]',
    'assert headings[0].find("w:pPr/w:pageBreakBefore", ns) is None',
    'assert headings[1].find("w:pPr/w:pageBreakBefore", ns) is not None',
    'assert not root.findall(".//w:p/w:br", ns)',
    'assert len(root.findall(".//w:r/w:br", ns)) == 2',
    'rels = ET.fromstring(z.read("word/_rels/document.xml.rels"))',
    'assert rels[0].get("Target") == "styles.xml"',
    'ET.fromstring(z.read("word/styles.xml"))',
    'ET.fromstring(z.read("[Content_Types].xml"))',
    'ET.fromstring(z.read("_rels/.rels"))'
  ].join('\n'), archive], { encoding: 'utf8' });
  assert.equal(verify.status, 0, verify.stderr || verify.stdout);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log('export tests passed');

const styled={title:'Styled',chapters:[{title:'Words',text:'Bold and italic\n\nBoth <safe>',alignment:'justify',lineSpacing:2,formats:[{start:0,end:4,bold:true},{start:9,end:15,italic:true},{start:17,end:21,bold:true,italic:true}]}]};
assert.match(WritingExport.html(styled),/line-height:2"><strong>Bold<\/strong> and <em>italic<\/em>/);
assert.match(WritingExport.html(styled),/<strong><em>Both<\/em><\/strong> &lt;safe&gt;/);
assert.match(WritingExport.markdown(styled),/\*\*Bold\*\* and \*italic\*/);
assert.equal(WritingExport.text(styled),'Styled\n\nWords\n\nBold and italic\n\nBoth <safe>');
const styledTmp=fs.mkdtempSync(path.join(os.tmpdir(),'writing-styled-'));
try{
  const styledPath=path.join(styledTmp,'styled.docx');fs.writeFileSync(styledPath,WritingExport.docx(styled));
  const checked=spawnSync('python3',['-c',String.raw`
import sys,zipfile,xml.etree.ElementTree as ET
with zipfile.ZipFile(sys.argv[1]) as z:
    root=ET.fromstring(z.read('word/document.xml'))
ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
paras=root.findall('.//w:body/w:p',ns)
assert ''.join(t.text or '' for t in paras[2].findall('.//w:t',ns))=='Bold and italic'
runs=paras[2].findall('w:r',ns)
assert runs[0].find('w:rPr/w:b',ns) is not None
assert runs[-1].find('w:rPr/w:i',ns) is not None
both=paras[3].find('w:r',ns)
assert both.find('w:rPr/w:b',ns) is not None and both.find('w:rPr/w:i',ns) is not None
assert paras[2].find('w:pPr/w:spacing',ns).get('{'+ns['w']+'}line')=='480'
` ,styledPath],{encoding:'utf8'});assert.equal(checked.status,0,checked.stderr);
}finally{fs.rmSync(styledTmp,{recursive:true,force:true});}
console.log('Styled manuscript export checks passed');
