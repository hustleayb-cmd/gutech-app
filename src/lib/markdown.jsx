// A small hand-rolled markdown-to-JSX renderer for chat bot replies —
// no dependency pulled in for what's really just bold text, bullet
// lists, and paragraphs. Handles: **bold**, *italic*, `code`, "* "/"- "
// bullet lists, and blank-line-separated paragraphs. Not a full
// CommonMark implementation — bot replies don't need tables or nested
// lists, and a real parser would be a lot of weight for this.

let keyCounter = 0;
function nextKey() { return `md-${keyCounter++}`; }

// Inline formatting within a single line/paragraph: bold, italic, code.
function renderInline(text) {
  const nodes = [];
  const re = /\*\*(.+?)\*\*|`(.+?)`|\*(.+?)\*/g;
  let last = 0;
  let match;
  while ((match = re.exec(text))) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    if (match[1] !== undefined) nodes.push(<strong key={nextKey()}>{match[1]}</strong>);
    else if (match[2] !== undefined) nodes.push(<code key={nextKey()}>{match[2]}</code>);
    else if (match[3] !== undefined) nodes.push(<em key={nextKey()}>{match[3]}</em>);
    last = re.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function renderMarkdown(text) {
  if (!text) return null;
  const blocks = text.trim().split(/\n{2,}/);

  return blocks.map(block => {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    const isList = lines.length > 0 && lines.every(l => /^[*-]\s+/.test(l));

    if (isList) {
      return (
        <ul key={nextKey()} className="md-list">
          {lines.map(l => <li key={nextKey()}>{renderInline(l.replace(/^[*-]\s+/, ''))}</li>)}
        </ul>
      );
    }

    return (
      <p key={nextKey()} className="md-p">
        {lines.map((l, i) => (
          <span key={nextKey()}>{renderInline(l)}{i < lines.length - 1 ? <br /> : null}</span>
        ))}
      </p>
    );
  });
}
