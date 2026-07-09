// The Java interpreter (language/src/main/java/UrduLang.java) is the single
// source of truth for the Urdu language — see the language-standardization
// pass that removed this file's execution engine. This file now exists only
// to give the CodeMirror editor (urdu-codemirror.ts) the exact same keyword
// list Java recognizes, so highlighting never silently drifts from what
// actually runs again.
//
// Keep this in sync with UrduLang.java's `keywordOrIdent` switch.
export const KEYWORDS: ReadonlySet<string> = new Set([
  'رکھو', 'پڑھو', 'لکھو',
  'اگر', 'ورنہ',
  'جبتک', 'کے لیے', 'کےلیے', 'ہر ایک',
  'فنکشن', 'واپس',
  'قسم', 'نیا', 'کام', 'یہ', 'وارث', 'والدین',
  'سچ', 'جھوٹ', 'خالی',
  'اور', 'یا', 'نہیں',
  'عدد', 'متن', 'منطقی',
  'میں',
  'رکو', 'جاری',
  'کوشش', 'پکڑو',
])
