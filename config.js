// Rule config: id, name, description, enabled, severity
window.RULES_CONFIG = [
  {
    id: 'multi-space',
    name: 'Multiple space check',
    description: 'Flags 2 or more consecutive spaces or tab characters found in visible text content',
    enabled: true,
    severity: 'error'
  },
  {
    id: 'invalid-char-spacing',
    name: 'Invalid character spacing',
    description: 'Flags missing spaces after dots, numbers followed by letters, and lowercase followed by uppercase in visible text content.',
    enabled: true,
    severity: 'error'
  },
  {
    id: 'paragraph-start-case',
    name: 'Paragraph start case',
    description: 'Flags block-level elements whose visible text begins with a lowercase letter.',
    enabled: true,
    severity: 'error'
  },
  {
    id: 'duplicate-id',
    name: 'Duplicate ID check',
    description: 'Flags any id attribute value that appears more than once in the document.',
    enabled: true,
    severity: 'error'
  },
  {
    id: 'pagebreak-sequence',
    name: 'Pagebreak sequence check',
    description: 'Flags pagebreak tags whose page number is out of sequence.',
    enabled: true,
    severity: 'error'
  },
  {
    id: 'italic-paren-start',
    name: 'Italic parenthesis check',
    description: 'Flags italic tags whose text starts with "(" or ends with ")".',
    enabled: true,
    severity: 'error'
  },
  {
    id: 'sup-sequence',
    name: 'Superscript sequence check',
    description: 'Flags superscript tags whose numeric value is out of sequence. Starts after </header>, stops before the footnotes section. Non-numeric sup values are ignored.',
    enabled: false,
    severity: 'error'
  },
  {
    id: 'raw-entity',
    name: 'Raw character entity check',
    description: 'Flags characters that should be encoded as HTML entities but appear as raw characters in the text.',
    enabled: true,
    severity: 'error'
  },
  {
    id: 'encoded-entity',
    name: 'Encoded entity check',
    description: 'Warns when &#x27; or &#39; encoded apostrophe entities are found in the file.',
    enabled: true,
    severity: 'warn'
  },
  { id: 'file-size', name: 'File Size Limit', description: 'File must not exceed 300KB', enabled: true, severity: 'error' },
  { id: 'para-end-punctuation', name: 'Paragraph End Punctuation', description: 'Every <p> tag must end with . or ; before closing', enabled: true, severity: 'error' },
  { id: 'li-span-between', name: 'Span Between List Items', description: 'A <span> tag must not appear between </li> and <li>', enabled: true, severity: 'error' },
  { id: 'unlinked-reference', name: 'Missing Hyperlink on Reference Text', description: 'Flags cross-reference keywords (Figure, Table, Ch. etc.) followed by a number that are not wrapped in an <a> tag', enabled: true, severity: 'warn' },
  { id: 'raw-url', name: 'Raw URL in Text', description: 'Flags raw URLs (http, https, www, ftp, mailto) found in visible text content', enabled: true, severity: 'warn' }
];
