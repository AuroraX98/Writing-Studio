const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const WritingPdf = require('../app/pdf.js');

const python = process.env.WRITING_DESK_TEST_PYTHON || 'python3';
const outputDir = path.join(__dirname, '..', 'work', 'pdf-check');
const outputPath = path.join(outputDir, 'test-manuscript.pdf');

const numberedParagraphs = Array.from({ length: 72 }, (_, index) => {
  const number = String(index + 1).padStart(3, '0');
  return `Paragraph ${number}: This unique sentence exercises paragraph wrapping, reading order, and pagination in the exported manuscript. It includes enough ordinary prose to occupy several lines on a printed page.`;
});

const project = {
  title: 'Café Stories — “A Writer’s Journey”',
  privateNotes: 'PRIVATE PROJECT NOTE MUST NOT APPEAR IN THE PDF',
  chapters: [
    {
      title: 'First — The beginning',
      text: [
        'Accents: Café, naïve, résumé. Curly quotes: “hello” and ‘goodbye’.',
        'Greek: Ελληνικά. Cyrillic: Привет, мир.',
        'Long word: ' + 'unbroken'.repeat(30),
        ...numberedParagraphs.slice(0, 37),
      ].join('\n\n'),
      notes: 'PRIVATE CHAPTER NOTE MUST NOT APPEAR IN THE PDF',
      summary: 'PRIVATE SUMMARY MUST NOT APPEAR IN THE PDF',
    },
    { title: 'Second — Blank chapter', text: '   \n\t  ' },
    {
      title: 'Third — The return',
      text: numberedParagraphs.slice(37).join('\n\n'),
    },
  ],
};

fs.mkdirSync(outputDir, { recursive: true });
const bytes = WritingPdf.pdf(project);
assert.ok(bytes instanceof Uint8Array, 'pdf(project) should return a Uint8Array synchronously');
assert.ok(new TextDecoder().decode(bytes.slice(0, 8)).startsWith('%PDF-1.'), 'output should have a PDF header');
fs.writeFileSync(outputPath, bytes);

const inspection = spawnSync(python, ['-c', String.raw`
import json, sys
from pypdf import PdfReader
import pdfplumber

path = sys.argv[1]
reader = PdfReader(path, strict=True)
with pdfplumber.open(path) as pdf:
    pages = []
    for page in pdf.pages:
        chars = page.chars
        pages.append({
            "text": page.extract_text() or "",
            "width": page.width,
            "height": page.height,
            "chars": [{"text": c["text"], "x0": c["x0"], "x1": c["x1"], "top": c["top"], "bottom": c["bottom"]} for c in chars],
        })
print(json.dumps({"page_count": len(reader.pages), "pages": pages}, ensure_ascii=False))
`, outputPath], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
assert.equal(inspection.status, 0, inspection.stderr || inspection.stdout);
const report = JSON.parse(inspection.stdout);

assert.ok(report.page_count >= 3, `expected multiple pages, got ${report.page_count}`);
assert.equal(report.pages.length, report.page_count);

const allText = report.pages.map((page) => page.text).join('\n');
assert.ok(allText.includes(project.title), 'PDF should preserve the manuscript title');
assert.ok(allText.includes('Café') && allText.includes('naïve') && allText.includes('résumé'), 'PDF should preserve accented Latin text');
assert.ok(allText.includes('“hello”') && allText.includes('‘goodbye’'), 'PDF should preserve curly quotation marks');
assert.ok(allText.includes('Ελληνικά'), 'PDF should preserve Greek text');
assert.ok(allText.includes('Привет'), 'PDF should preserve Cyrillic text');
assert.ok(allText.replace(/\s/g, '').includes('unbroken'.repeat(30)), 'PDF should preserve a long word without spaces');
assert.ok(allText.includes('First — The beginning'));
assert.ok(allText.includes('Second — Blank chapter'));
assert.ok(allText.includes('Third — The return'));
assert.ok(allText.indexOf('First — The beginning') < allText.indexOf('Second — Blank chapter'));
assert.ok(allText.indexOf('Second — Blank chapter') < allText.indexOf('Third — The return'));
assert.ok(allText.includes('Paragraph 001:'));
assert.ok(allText.includes('Paragraph 072:'));
assert.doesNotMatch(allText, /PRIVATE (?:PROJECT NOTE|CHAPTER NOTE|SUMMARY)/);

for (let pageIndex = 0; pageIndex < report.pages.length; pageIndex += 1) {
  const page = report.pages[pageIndex];
  assert.ok(Math.abs(page.width - 612) < 1 && Math.abs(page.height - 792) < 1,
    `page ${pageIndex + 1} should use US Letter dimensions; got ${page.width} × ${page.height}`);
  assert.ok(page.chars.length > 0, `page ${pageIndex + 1} should contain text`);

  // Text other than the small centered page number should stay within 1-inch body margins.
  const footerChars = page.chars.filter((char) => char.top >= page.height - 72);
  const bodyChars = page.chars.filter((char) => char.top < page.height - 72);
  assert.ok(bodyChars.length > 0, `page ${pageIndex + 1} should contain body text above the footer area`);
  for (const char of bodyChars) {
    assert.ok(char.x0 >= 70 && char.x1 <= page.width - 70,
      `page ${pageIndex + 1} has body text outside 1-inch side margins: ${JSON.stringify(char)}`);
    assert.ok(char.top >= 70 && char.bottom <= page.height - 70,
      `page ${pageIndex + 1} has body text outside 1-inch top/bottom margins: ${JSON.stringify(char)}`);
  }

  const footerText = footerChars.map((char) => char.text).join('').trim();
  assert.match(footerText, new RegExp(`(?:page\\s*)?${pageIndex + 1}\\s*$`, 'i'),
    `page ${pageIndex + 1} should show its page number in the footer; got ${JSON.stringify(footerText)}`);

  // Glyph boxes must remain valid and distinct text glyphs must not physically overlap.
  const sorted = [...page.chars].sort((a, b) => a.top - b.top || a.x0 - b.x0);
  for (const char of sorted) {
    assert.ok(char.x1 > char.x0 && char.bottom > char.top,
      `page ${pageIndex + 1} has an invalid glyph box: ${JSON.stringify(char)}`);
  }
  for (let i = 0; i < sorted.length; i += 1) {
    const a = sorted[i];
    for (let j = i + 1; j < sorted.length; j += 1) {
      const b = sorted[j];
      if (b.top >= a.bottom) break;
      const overlapX = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
      const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      assert.ok(!(overlapX > 0.25 && overlapY > 0.25),
        `page ${pageIndex + 1} has overlapping glyphs ${JSON.stringify(a)} and ${JSON.stringify(b)}`);
    }
  }
}

assert.throws(
  () => WritingPdf.pdf({ title: 'Unsupported glyph test', chapters: [{ title: 'Text', text: '漢' }] }),
  (error) => /Print|save as PDF/i.test(error.message) && /漢/.test(error.message),
  'unsupported glyphs should produce a readable error that directs the user to Print/save as PDF',
);

console.log(`PDF export checks passed (${report.page_count} pages; fixture: ${outputPath})`);

// Inspect actual rendered glyph positions, including paragraph endings.
const alignmentPath = path.join(outputDir, 'alignment-manuscript.pdf');
fs.writeFileSync(alignmentPath, WritingPdf.pdf({title:'Alignment',chapters:[
  {title:'Left',alignment:'left',text:'A short line.'},
  {title:'Right',alignment:'right',text:'A short line.'},
  {title:'Justified',alignment:'justify',text:('Readable words give each line enough spaces to stretch across the page. ').repeat(9)+'End.\nExplicit final line.'}
]}));
const alignmentInspection=spawnSync(python,['-c',String.raw`
import json, sys
import pdfplumber
result=[]
with pdfplumber.open(sys.argv[1]) as pdf:
    for page in pdf.pages:
        groups={}
        for char in page.chars:
            if abs(char['size']-12)<0.1:
                groups.setdefault(round(char['top'],2),[]).append(char)
        result.append([{'left':min(c['x0'] for c in line),'right':max(c['x1'] for c in line),'text':''.join(c['text'] for c in line)} for _,line in sorted(groups.items())])
print(json.dumps(result))
`,alignmentPath],{encoding:'utf8'});
assert.equal(alignmentInspection.status,0,alignmentInspection.stderr);
const aligned=JSON.parse(alignmentInspection.stdout);
assert.ok(Math.abs(aligned[0][0].left-72)<0.1,'Left text should start at the left margin');
assert.ok(Math.abs(aligned[1][0].right-540)<0.1,'Right text should end at the right margin');
assert.equal(aligned[0][0].text,aligned[1][0].text,'Alignment should preserve the actual text');
const justified=aligned[2];
assert.ok(justified.length>3,'The justified paragraph should wrap');
for(const line of justified.slice(0,-2)){
  assert.ok(Math.abs(line.left-72)<0.1 && Math.abs(line.right-540)<0.1,'Wrapped justified lines should reach both margins');
}
assert.ok(Math.abs(justified.at(-2).left-72)<0.1 && justified.at(-2).right<539,'The last paragraph line should stay left aligned');
assert.equal(justified.at(-1).text,'Explicit final line.');
assert.ok(Math.abs(justified.at(-1).left-72)<0.1 && justified.at(-1).right<539,'An explicit final line should not stretch');
console.log('PDF alignment checks passed');

const styledPath=path.join(outputDir,'styled-manuscript.pdf');
const styledText=('Bold words and italic words keep their places. Café, résumé, Ελληνικά, Привет. ').repeat(70)+' Final sentence.';
const styledFormats=[{start:0,end:10,bold:true},{start:15,end:28,italic:true},{start:80,end:250,bold:true,italic:true},{start:400,end:styledText.length,italic:true}];
const styledProject={title:'Formatting and spacing',chapters:[{title:'Styled chapter',text:styledText,formats:styledFormats,lineSpacing:2,alignment:'justify'}]};
const styledBytes=WritingPdf.pdf(styledProject);fs.writeFileSync(styledPath,styledBytes);
const styledReport=spawnSync(python,['-c',String.raw`
import sys,json
import pdfplumber
from pypdf import PdfReader
reader=PdfReader(sys.argv[1],strict=True)
ops=[operation for page in reader.pages for operation in page.get_contents().operations]
assert any(op==b'Tr' and int(args[0])==2 for args,op in ops), 'bold text should use fill-and-stroke'
assert any(op==b'Tm' and abs(float(args[2])-.2)<.001 for args,op in ops), 'italic text should use a skewed text matrix'
with pdfplumber.open(sys.argv[1]) as pdf:
    alltext=''.join(c['text'] for page in pdf.pages for c in page.chars if abs(c['size']-12)<.1)
    lines=[]
    for page in pdf.pages:
        for c in page.chars:
            if c['top']<720:
                assert c['x0']>=70 and c['x1']<=542, c
        starts=sorted(set(round(c['top'],2) for c in page.chars if abs(c['size']-12)<.1))
        if len(starts)>2: lines.extend([round(starts[i]-starts[i-1],2) for i in range(1,len(starts))])
print(json.dumps({'text':alltext,'leading':lines,'pages':len(reader.pages)},ensure_ascii=False))
`,styledPath],{encoding:'utf8',maxBuffer:4*1024*1024});
assert.equal(styledReport.status,0,styledReport.stderr);
const styledInspection=JSON.parse(styledReport.stdout);
assert.equal(styledInspection.text.replace(/\s/g,''),styledText.replace(/\s/g,''),'Styling should preserve all actual exported glyphs in their reading order');
assert.ok(styledInspection.leading.every(distance=>Math.abs(distance-24)<.1),'Double-spaced manuscript lines should stay 24 points apart');
const compact=WritingPdf.pdf({...styledProject,chapters:[{...styledProject.chapters[0],lineSpacing:1.4}]});
const compactCount=Number(new TextDecoder().decode(compact).match(/\/Type \/Pages[^\n]*\/Count (\d+)/)[1]);
assert.ok(compactCount<styledInspection.pages,'Tighter line spacing should fit the same manuscript onto fewer pages');
console.log(`Styled PDF checks passed (${styledInspection.pages} pages, double spaced)`);
