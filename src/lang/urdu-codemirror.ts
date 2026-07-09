import { StreamLanguage } from '@codemirror/language'
import { KEYWORDS } from './lexer'

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
      const word = stream.current()

      // Two-word compound keywords ("کے لیے", "ہر ایک"), matching the same
      // lookahead-merge the Java lexer does — so these highlight as
      // keywords instead of two plain identifiers.
      if (word === 'کے' || word === 'ہر') {
        const savedPos = stream.pos
        stream.eatSpace()
        if (stream.match(IDENT_RE)) {
          const word2 = stream.current()
          if ((word === 'کے' && word2 === 'لیے') || (word === 'ہر' && word2 === 'ایک')) {
            return 'keyword'
          }
        }
        stream.pos = savedPos
      }

      return KEYWORDS.has(word) ? 'keyword' : 'variable'
    }

    stream.next()
    return null
  },
})
