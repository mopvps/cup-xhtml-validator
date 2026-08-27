// Parses uploaded XHTML file: raw text, lines, DOM, text-only mask per line
window.XhtmlParser = {
  parse(rawText) {
    const lines = rawText.split(/\r\n|\r|\n/);

    // Build per-line boolean mask: true = char is outside any tag (visible text)
    const textMask = [];
    let inTag = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const mask = new Array(line.length).fill(false);
      for (let c = 0; c < line.length; c++) {
        const ch = line[c];
        if (ch === '<') {
          inTag = true;
          mask[c] = false;
          continue;
        }
        if (ch === '>') {
          inTag = false;
          mask[c] = false;
          continue;
        }
        mask[c] = !inTag;
      }
      textMask.push(mask);
    }

    let dom = null;
    let parseError = null;
    try {
      const domParser = new DOMParser();
      dom = domParser.parseFromString(rawText, 'application/xhtml+xml');
      const errNode = dom.querySelector('parsererror');
      if (errNode) parseError = errNode.textContent;
    } catch (e) {
      parseError = e.message;
    }

    return { raw: rawText, lines, textMask, dom, parseError };
  }
};
