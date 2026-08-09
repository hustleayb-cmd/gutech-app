import { useState } from 'react';
import { QuoteIcon, ResetIcon } from './Icons';
import { QUOTES } from '../lib/motivationQuotes';

const LAST_INDEX_KEY = 'gutech-last-motivation-index';

// Random index, excluding `exclude` when there's more than one quote to
// choose from — keeps back-to-back repeats from happening.
function pickIndex(exclude) {
  if (QUOTES.length <= 1) return 0;
  let i = exclude;
  while (i === exclude) i = Math.floor(Math.random() * QUOTES.length);
  return i;
}

export default function Motivation() {
  // Picked once per mount (page load, or each time this tab is opened —
  // the component remounts either way), reading the previous pick from
  // localStorage so a refresh doesn't just show the same line again.
  const [index, setIndex] = useState(() => {
    const last = Number(localStorage.getItem(LAST_INDEX_KEY));
    const next = pickIndex(Number.isInteger(last) ? last : -1);
    localStorage.setItem(LAST_INDEX_KEY, String(next));
    return next;
  });

  function shuffle() {
    const next = pickIndex(index);
    localStorage.setItem(LAST_INDEX_KEY, String(next));
    setIndex(next);
  }

  return (
    <>
      <div className="annot">Motivation</div>

      <div className="card motivation-card">
        <QuoteIcon size={26} className="motivation-mark" />
        <p className="motivation-text">{QUOTES[index]}</p>
        <button type="button" className="ghost motivation-shuffle" onClick={shuffle}>
          <ResetIcon size={13} /> Another one
        </button>
      </div>
    </>
  );
}
