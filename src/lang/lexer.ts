export type TokenType =
  | 'RAKHO'       // رکھو — declare variable
  | 'PARHO'       // پڑھو — read input
  | 'LIKHO'       // لکھو — print
  | 'AGAR'        // اگر  — if
  | 'WARNA'       // ورنہ — else
  | 'JAB'         // جب   — while
  | 'KAM'         // کام  — function
  | 'WAPAS'       // واپس — return
  | 'QISM'        // قسم  — class
  | 'NAYA'        // نیا  — new
  | 'YEH'         // یہ   — this
  | 'SACH'        // سچ   — true
  | 'JHOOT'       // جھوٹ — false
  | 'IDENTIFIER'
  | 'NUMBER'
  | 'STRING'
  | 'ASSIGN'      // =
  | 'EQ'          // ==
  | 'NEQ'         // !=
  | 'GTE'         // >=
  | 'LTE'         // <=
  | 'GT'          // >
  | 'LT'          // <
  | 'PLUS'        // +
  | 'MINUS'       // -
  | 'STAR'        // *
  | 'SLASH'       // /
  | 'DOT'         // .
  | 'LPAREN'      // (
  | 'RPAREN'      // )
  | 'LBRACE'      // {
  | 'RBRACE'      // }
  | 'LBRACKET'    // [
  | 'RBRACKET'    // ]
  | 'COMMA'       // ,
  | 'SEMICOLON'   // ؛ or ;
  | 'EOF'

export interface Token {
  type: TokenType
  value: string
  line: number
}

const KEYWORDS: Record<string, TokenType> = {
  'رکھو': 'RAKHO',
  'پڑھو': 'PARHO',
  'لکھو': 'LIKHO',
  'اگر':  'AGAR',
  'ورنہ': 'WARNA',
  'جب':   'JAB',
  'کام':  'KAM',
  'واپس': 'WAPAS',
  'قسم':  'QISM',
  'نیا':  'NAYA',
  'یہ':   'YEH',
  'سچ':   'SACH',
  'جھوٹ': 'JHOOT',
}

const URDU_SEMICOLON = '؛'  // U+061B
const URDU_COMMA     = '،'  // U+060C — in Arabic range, must be excluded from identifier scanner

function isUrduLetter(ch: string): boolean {
  const cp = ch.codePointAt(0) ?? 0
  return (
    (cp >= 0x0600 && cp <= 0x06FF) ||
    (cp >= 0x0750 && cp <= 0x077F) ||
    (cp >= 0xFB50 && cp <= 0xFDFF) ||
    (cp >= 0xFE70 && cp <= 0xFEFF)
  )
}

// Accepts both ASCII digits (0-9) and Urdu-Indic digits (۰-۹, U+06F0–U+06F9)
function isDigit(ch: string): boolean {
  const cp = ch.codePointAt(0) ?? 0
  return (cp >= 48 && cp <= 57) || (cp >= 0x06F0 && cp <= 0x06F9)
}

// Normalise a digit character to its ASCII equivalent
function digitToAscii(ch: string): string {
  const cp = ch.codePointAt(0) ?? 0
  if (cp >= 0x06F0 && cp <= 0x06F9) return String(cp - 0x06F0)
  return ch
}

export class LexError extends Error {
  constructor(msg: string, public line: number) {
    super(msg)
    this.name = 'LexError'
  }
}

export function tokenize(source: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  let line = 1

  while (i < source.length) {
    const ch = source[i] ?? ''

    if (ch === '\n') { line++; i++; continue }
    if (ch === '\r') { i++; continue }
    if (ch === ' ' || ch === '\t') { i++; continue }

    // Single-line comments
    if (ch === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') i++
      continue
    }

    // String literal
    if (ch === '"') {
      let str = ''
      i++
      while (i < source.length && source[i] !== '"') {
        str += source[i]
        i++
      }
      if (i >= source.length) throw new LexError('متن نامکمل ہے — بند کومہ غائب ہے', line)
      i++
      tokens.push({ type: 'STRING', value: str, line })
      continue
    }

    // Number literal — ASCII or Urdu-Indic digits
    if (isDigit(ch)) {
      let num = ''
      while (i < source.length && isDigit(source[i] ?? '')) {
        num += digitToAscii(source[i] ?? '')
        i++
      }
      if (source[i] === '.' && isDigit(source[i + 1] ?? '')) {
        num += '.'
        i++
        while (i < source.length && isDigit(source[i] ?? '')) {
          num += digitToAscii(source[i] ?? '')
          i++
        }
      }
      tokens.push({ type: 'NUMBER', value: num, line })
      continue
    }

    // Two-character operators
    const two = source.slice(i, i + 2)
    if (two === '==') { tokens.push({ type: 'EQ',  value: '==', line }); i += 2; continue }
    if (two === '!=') { tokens.push({ type: 'NEQ', value: '!=', line }); i += 2; continue }
    if (two === '>=') { tokens.push({ type: 'GTE', value: '>=', line }); i += 2; continue }
    if (two === '<=') { tokens.push({ type: 'LTE', value: '<=', line }); i += 2; continue }

    // Single-character tokens
    if (ch === '=') { tokens.push({ type: 'ASSIGN',    value: ch, line }); i++; continue }
    if (ch === '>') { tokens.push({ type: 'GT',        value: ch, line }); i++; continue }
    if (ch === '<') { tokens.push({ type: 'LT',        value: ch, line }); i++; continue }
    if (ch === '+') { tokens.push({ type: 'PLUS',      value: ch, line }); i++; continue }
    if (ch === '-') { tokens.push({ type: 'MINUS',     value: ch, line }); i++; continue }
    if (ch === '*') { tokens.push({ type: 'STAR',      value: ch, line }); i++; continue }
    if (ch === '/') { tokens.push({ type: 'SLASH',     value: ch, line }); i++; continue }
    if (ch === '.') { tokens.push({ type: 'DOT',       value: ch, line }); i++; continue }
    if (ch === '(') { tokens.push({ type: 'LPAREN',    value: ch, line }); i++; continue }
    if (ch === ')') { tokens.push({ type: 'RPAREN',    value: ch, line }); i++; continue }
    if (ch === '{') { tokens.push({ type: 'LBRACE',    value: ch, line }); i++; continue }
    if (ch === '}') { tokens.push({ type: 'RBRACE',    value: ch, line }); i++; continue }
    if (ch === '[') { tokens.push({ type: 'LBRACKET',  value: ch, line }); i++; continue }
    if (ch === ']') { tokens.push({ type: 'RBRACKET',  value: ch, line }); i++; continue }

    if (ch === URDU_SEMICOLON || ch === ';') {
      tokens.push({ type: 'SEMICOLON', value: ch, line }); i++; continue
    }

    if (ch === URDU_COMMA || ch === ',') {
      tokens.push({ type: 'COMMA', value: ch, line }); i++; continue
    }

    // Urdu identifiers and keywords — ؛ and ، are excluded above
    if (isUrduLetter(ch) && ch !== URDU_SEMICOLON && ch !== URDU_COMMA) {
      let word = ''
      while (i < source.length && isUrduLetter(source[i] ?? '') && source[i] !== URDU_SEMICOLON && source[i] !== URDU_COMMA) {
        word += source[i]
        i++
      }
      const kwType = KEYWORDS[word]
      tokens.push({ type: kwType ?? 'IDENTIFIER', value: word, line })
      continue
    }

    throw new LexError(`"${ch}" ناقابلِ قبول حرف ہے`, line)
  }

  tokens.push({ type: 'EOF', value: '', line })
  return tokens
}
