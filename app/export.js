(function (root, factory) {
  const formatting = typeof module === 'object' && module.exports ? require('./text-tools.js') : root.WritingTextTools;
  const api = factory(formatting);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.WritingExport = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (formatting) {
  'use strict';

  function value(value) {
    return value == null ? '' : String(value);
  }

  function chaptersOf(project) {
    return Array.isArray(project && project.chapters) ? project.chapters : [];
  }

  function alignment(chapter) {
    return ['left', 'right', 'justify'].includes(chapter && chapter.alignment) ? chapter.alignment : 'left';
  }

  function splitParagraphs(text) {
    return value(text).replace(/\r\n?/g, '\n').split(/\n\s*\n/);
  }

  function escapeHtml(text) {
    return value(text).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function escapeXml(text) {
    return value(text).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  function text(project) {
    const title = value(project && project.title);
    const sections = chaptersOf(project).map(function (chapter) {
      return [value(chapter && chapter.title), value(chapter && chapter.text)].filter(Boolean).join('\n\n');
    });
    return [title, ...sections].filter(Boolean).join('\n\n');
  }

  function markdown(project) {
    const title = value(project && project.title);
    const sections = chaptersOf(project).map(function (chapter) {
      return '## ' + value(chapter && chapter.title) + '\n\n' + formatting.markdown(value(chapter && chapter.text), chapter && chapter.formats);
    });
    return [title ? '# ' + title : '', ...sections].filter(Boolean).join('\n\n');
  }

  function paragraphRanges(textValue) {
    const source = value(textValue), ranges = []; let start = 0;
    const separators = /\r?\n[ \t\r\n]*\r?\n/g; let match;
    while ((match = separators.exec(source))) { ranges.push({start, end:match.index}); start = separators.lastIndex; }
    ranges.push({start, end:source.length}); return ranges;
  }

  function paragraphRuns(chapter, range) {
    return formatting.runs(value(chapter && chapter.text), chapter && chapter.formats).filter(run => run.start < range.end && run.end > range.start).map(run => ({...run, text:run.text.slice(Math.max(0, range.start-run.start), Math.min(run.text.length, range.end-run.start))}));
  }

  function lineSpacing(chapter) { return [1.4,1.7,2].includes(chapter && chapter.lineSpacing) ? chapter.lineSpacing : 1.7; }

  function html(project) {
    const title = value(project && project.title);
    const chapterMarkup = chaptersOf(project).map(function (chapter, index) {
      const paragraphs = paragraphRanges(chapter && chapter.text).map(function (range) {
        const markup = paragraphRuns(chapter, range).map(run => { let content = escapeHtml(run.text).replace(/\r\n?|\n/g, '<br>'); if(run.italic) content='<em>'+content+'</em>'; if(run.bold) content='<strong>'+content+'</strong>'; return content; }).join('');
        return '<p style="text-align:' + alignment(chapter) + ';line-height:' + lineSpacing(chapter) + '">' + markup + '</p>';
      }).join('\n');
      return '<section class="chapter' + (index ? ' chapter-break' : '') + '">\n' +
        '  <h2>' + escapeHtml(chapter && chapter.title) + '</h2>\n' + paragraphs + '\n</section>';
    }).join('\n');
    return '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
      '<title>' + escapeHtml(title) + '</title>\n<style>\n' +
      'body{max-width:44rem;margin:3rem auto;padding:0 1.25rem;color:#222;font-family:Georgia,"Times New Roman",serif;font-size:12pt;line-height:1.65}\n' +
      'h1,h2{font-weight:normal;line-height:1.25}h1{text-align:center;margin:0 0 3rem}h2{margin:2.5rem 0 1.25rem;page-break-after:avoid}\n' +
      'p{margin:0 0 1em;white-space:normal}\n' +
      '@media print{body{max-width:none;margin:0;padding:0}h1{margin-top:0}.chapter-break{break-before:page;page-break-before:always}}\n' +
      '@page{margin:1in}\n</style>\n</head>\n<body>\n' +
      (title ? '<h1>' + escapeHtml(title) + '</h1>\n' : '') + chapterMarkup +
      '\n</body>\n</html>\n';
  }

  const encoder = new TextEncoder();
  const crcTable = (function () {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i += 1) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function wordText(chapter) {
    return paragraphRanges(chapter && chapter.text).map(function (range) {
      const runs = paragraphRuns(chapter, range).map(function (run) {
        const properties = (run.bold ? '<w:b/>' : '') + (run.italic ? '<w:i/>' : '');
        return run.text.split(/\r\n?|\n/).map(function (line, index) {
          return '<w:r>' + (properties ? '<w:rPr>' + properties + '</w:rPr>' : '') + (index ? '<w:br/>' : '') + '<w:t xml:space="preserve">' + escapeXml(line) + '</w:t></w:r>';
        }).join('');
      }).join('');
      const chapterAlignment = alignment(chapter);
      return '<w:p><w:pPr><w:jc w:val="' + (chapterAlignment === 'justify' ? 'both' : chapterAlignment) + '"/><w:spacing w:line="'+Math.round(lineSpacing(chapter)*240)+'" w:lineRule="auto"/></w:pPr>' + runs + '</w:p>';
    }).join('');
  }

  function docx(project) {
    const body = [];
    const title = value(project && project.title);
    if (title) body.push('<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>' + escapeXml(title) + '</w:t></w:r></w:p>');
    chaptersOf(project).forEach(function (chapter, index) {
      body.push('<w:p><w:pPr><w:pStyle w:val="Heading1"/>' + (index ? '<w:pageBreakBefore/>' : '') + '</w:pPr><w:r><w:t>' + escapeXml(chapter && chapter.title) + '</w:t></w:r></w:p>');
      body.push(wordText(chapter));
    });
    const documentXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>' +
      body.join('') + '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>';
    const contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>';
    const relationships = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
    const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:sz w:val="24"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/><w:spacing w:after="480"/></w:pPr><w:rPr><w:sz w:val="36"/><w:b/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="360" w:after="240"/></w:pPr><w:rPr><w:b/><w:sz w:val="30"/></w:rPr></w:style></w:styles>';
    return zipStore([
      ['[Content_Types].xml', contentTypes],
      ['_rels/.rels', relationships],
      ['word/document.xml', documentXml],
      ['word/styles.xml', styles],
      ['word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>']
    ]);
  }

  function write16(out, offset, number) {
    out[offset] = number & 0xff;
    out[offset + 1] = (number >>> 8) & 0xff;
  }

  function write32(out, offset, number) {
    out[offset] = number & 0xff;
    out[offset + 1] = (number >>> 8) & 0xff;
    out[offset + 2] = (number >>> 16) & 0xff;
    out[offset + 3] = (number >>> 24) & 0xff;
  }

  function zipStore(entries) {
    const localParts = [];
    const centralParts = [];
    let localLength = 0;
    entries.forEach(function (entry) {
      const name = encoder.encode(entry[0]);
      const data = encoder.encode(entry[1]);
      const crc = crc32(data);
      const local = new Uint8Array(30 + name.length + data.length);
      write32(local, 0, 0x04034b50); write16(local, 4, 20); write16(local, 6, 0x0800);
      write16(local, 8, 0); write32(local, 14, crc); write32(local, 18, data.length); write32(local, 22, data.length);
      write16(local, 26, name.length); local.set(name, 30); local.set(data, 30 + name.length);
      localParts.push(local);

      const central = new Uint8Array(46 + name.length);
      write32(central, 0, 0x02014b50); write16(central, 4, 20); write16(central, 6, 20); write16(central, 8, 0x0800);
      write16(central, 10, 0); write32(central, 16, crc); write32(central, 20, data.length); write32(central, 24, data.length);
      write16(central, 28, name.length); write32(central, 42, localLength); central.set(name, 46);
      centralParts.push(central);
      localLength += local.length;
    });
    const centralLength = centralParts.reduce(function (sum, part) { return sum + part.length; }, 0);
    const end = new Uint8Array(22);
    write32(end, 0, 0x06054b50); write16(end, 8, entries.length); write16(end, 10, entries.length);
    write32(end, 12, centralLength); write32(end, 16, localLength);
    const result = new Uint8Array(localLength + centralLength + end.length);
    let offset = 0;
    localParts.concat(centralParts, [end]).forEach(function (part) { result.set(part, offset); offset += part.length; });
    return result;
  }

  function download(data, filename, mime) {
    if (typeof window === 'undefined' || typeof Blob === 'undefined' || !window.URL || !window.URL.createObjectURL) return false;
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'application/octet-stream' });
    const url = window.URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.href = url;
    link.download = filename || 'manuscript';
    link.style.display = 'none';
    window.document.body.appendChild(link);
    link.click();
    window.setTimeout(function () { link.remove(); window.URL.revokeObjectURL(url); }, 60000);
    return true;
  }

  return { text: text, markdown: markdown, html: html, docx: docx, download: download };
});
