import { useEffect, useRef } from 'react'
import { EditorView, lineNumbers, highlightActiveLine, highlightSpecialChars, drawSelection, keymap } from '@codemirror/view'
import { EditorState, type Extension } from '@codemirror/state'
import { history, defaultKeymap, historyKeymap, indentWithTab } from '@codemirror/commands'
import { bracketMatching, indentOnInput } from '@codemirror/language'
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { oneDark } from '@codemirror/theme-one-dark'
import { urduLanguage } from '../lang/urdu-codemirror'
import { toUrduNumerals } from '../lang/utils'

const extensions: Extension[] = [
  lineNumbers({ formatNumber: toUrduNumerals }),
  highlightSpecialChars(),
  history(),
  drawSelection(),
  indentOnInput(),
  bracketMatching(),
  closeBrackets(),
  highlightActiveLine(),
  keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]),
  oneDark,
  urduLanguage,
  EditorView.theme({
    '&': { height: '100%' },
    '.cm-scroller': {
      fontFamily: 'ui-monospace, monospace',
      fontSize: '14px',
      lineHeight: '1.8',
      direction: 'rtl',
    },
    '.cm-content': { padding: '12px 16px', direction: 'rtl' },
    '.cm-line': { direction: 'rtl' },
    '.cm-gutters': {
      background: '#21252b',
      border: 'none',
      borderLeft: '1px solid #2c313a',
    },
    '.cm-lineNumbers .cm-gutterElement': { minWidth: '2.5em', textAlign: 'center' },
    '.cm-activeLineGutter': { background: '#2c313a' },
  }),
]

interface Props {
  value: string
  onChange: (value: string) => void
}

export default function Editor({ value, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!containerRef.current) return
    const view = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [
          ...extensions,
          EditorView.updateListener.of(update => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString())
            }
          }),
        ],
      }),
      parent: containerRef.current,
    })
    viewRef.current = view
    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [])

  // Sync external value changes (e.g. opening a file) into CodeMirror
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== value) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } })
    }
  }, [value])

  return <div ref={containerRef} className="h-full overflow-hidden" />
}
