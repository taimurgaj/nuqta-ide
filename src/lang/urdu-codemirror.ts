import { StreamLanguage } from '@codemirror/language'

const KEYWORDS = new Set(['رکھو', 'پڑھو', 'لکھو', 'اگر', 'ورنہ', 'جب', 'سچ', 'جھوٹ', 'کام', 'واپس', 'قسم', 'نیا', 'یہ'])

// Urdu/Arabic identifier characters — excludes ؛ (U+061B) so it's never
// swallowed into a word token.
const IDENT_RE = /[؀-ؚ؜-ۿݐ-ݿﭐ-﷿ﹰ-﻿]+/

export const urduLanguage = StreamLanguage.define({
  token(stream) {
    // String literal — read to closing quote (or end of line)
    if (stream.peek() === '"') {
      stream.next()
      while (stream.peek() !== null && stream.peek() !== '"') stream.next()
      if (stream.peek() === '"') stream.next()
      return 'string'
    }

    // Urdu word — keyword or identifier
    if (stream.match(IDENT_RE)) {
      return KEYWORDS.has(stream.current()) ? 'keyword' : 'variable'
    }

    stream.next()
    return null
  },
})
