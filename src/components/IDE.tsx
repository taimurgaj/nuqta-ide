import { useEffect, useRef, useState } from 'react'
import Editor from './Editor'
import Explorer from './Explorer'
import { FeedbackModal } from './FeedbackModal'
import { type TreeNode, type FileNode, type DirNode } from '../types'
import { trackEvent } from '../lib/track'

type Line = { kind: 'output'; text: string } | { kind: 'input'; text: string }

interface Tab {
  path: string
  name: string
  handle: FileSystemFileHandle | null
}

const FILE_OPTS = {
  types: [{ description: 'اردو کوڈ', accept: { 'text/plain': ['.urdu'] as `.${string}`[] } }],
}

let untitledCounter = 0

const SAMPLE_PROGRAMS: Array<{ name: string; file: string; code: string }> = [
  {
    name: 'سلام دنیا',
    file: 'سلام.urdu',
    code: 'لکھو("سلام دنیا!")؛\n',
  },
  {
    name: 'گنتی کا لوپ',
    file: 'گنتی.urdu',
    code: `رکھو گنتی = ۱؛
جبتک (گنتی <= ۵) {
  لکھو("گنتی: " + گنتی)؛
  گنتی = گنتی + ۱؛
}
`,
  },
  {
    name: 'جوڑ فنکشن',
    file: 'جوڑ.urdu',
    code: `فنکشن جوڑ(الف، ب) {
  واپس الف + ب؛
}

لکھو(جوڑ(۱۰، ۲۰))؛
لکھو(جوڑ(۵، ۳۵))؛
`,
  },
  {
    name: 'اگر ورنہ',
    file: 'شرط.urdu',
    code: `رکھو عمر = ۱۸؛
اگر (عمر >= ۱۸) {
  لکھو("آپ بالغ ہیں")؛
} ورنہ {
  لکھو("آپ نابالغ ہیں")؛
}
`,
  },
  {
    name: 'فہرست',
    file: 'فہرست.urdu',
    code: `رکھو پھل = ["سیب"، "آم"، "کیلا"، "انار"]؛
ہر ایک (پھل میں پ) {
  لکھو("پھل: " + پ)؛
}
`,
  },
]

function updateDirInTree(nodes: TreeNode[], path: string, updater: (node: DirNode) => DirNode): TreeNode[] {
  return nodes.map(node => {
    if (node.kind !== 'dir') return node
    if (node.path === path) return updater(node)
    return { ...node, children: updateDirInTree(node.children, path, updater) }
  })
}

function findDir(nodes: TreeNode[], path: string): DirNode | null {
  for (const n of nodes) {
    if (n.kind === 'dir') {
      if (n.path === path) return n
      const found = findDir(n.children, path)
      if (found) return found
    }
  }
  return null
}

async function loadChildren(dirHandle: FileSystemDirectoryHandle, dirPath: string): Promise<TreeNode[]> {
  const nodes: TreeNode[] = []
  for await (const [name, handle] of dirHandle.entries()) {
    const nodePath = `${dirPath}/${name}`
    if (handle.kind === 'file') {
      nodes.push({ kind: 'file', name, path: nodePath, handle: handle as FileSystemFileHandle, parentHandle: dirHandle })
    } else {
      nodes.push({
        kind: 'dir', name, path: nodePath,
        handle: handle as FileSystemDirectoryHandle,
        parentHandle: dirHandle,
        children: [], expanded: false,
      })
    }
  }
  nodes.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  return nodes
}

export default function IDE() {
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [rootHandle, setRootHandle] = useState<FileSystemDirectoryHandle | null>(null)
  const [rootName, setRootName] = useState<string | null>(null)
  const [tree, setTree] = useState<TreeNode[]>([])
  const [lines, setLines] = useState<Line[]>([])
  const [running, setRunning] = useState(false)
  const [waitingForInput, setWaitingForInput] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [explorerWidth, setExplorerWidth] = useState(224)
  const [outputWidth, setOutputWidth] = useState(360)

  // Embedded mode — driven by URL params only. Triggered by either an edtech
  // assignment or a learn.nuqta.dev lesson (both are single-buffer sessions
  // with no reason to show the multi-file explorer/tabs UI).
  const urlParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
  const assignmentId = urlParams.get('assignmentId') ?? ''
  const lessonSlugParam = urlParams.get('lessonSlug') ?? ''
  const studentNameParam = urlParams.get('studentName') ?? ''
  const embeddedMode = Boolean(assignmentId) || Boolean(lessonSlugParam)

  const apiUrl = import.meta.env.VITE_API_URL as string | undefined

  // Per-tab content — avoids re-renders on every keystroke
  const tabContentsRef = useRef<Record<string, string>>({})
  const cancelledRef = useRef(false)
  const resolver = useRef<{ fn: ((val: string) => void) | null }>({ fn: null })
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const openInputRef = useRef<HTMLInputElement>(null)
  const tabsRef = useRef(tabs)
  tabsRef.current = tabs
  const activeTabPathRef = useRef<string | null>(activeTabPath)
  activeTabPathRef.current = activeTabPath

  const activeTab = tabs.find(t => t.path === activeTabPath) ?? null

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines, waitingForInput])

  useEffect(() => {
    if (waitingForInput) inputRef.current?.focus()
  }, [waitingForInput])

  // Warm up Railway API on mount so first run isn't slow
  useEffect(() => {
    if (apiUrl) fetch(`${apiUrl}/health`).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Embedded mode: load draft and open the assignment tab on mount
  useEffect(() => {
    if (!assignmentId) return
    const draft = localStorage.getItem(`ide-draft-${assignmentId}`) ?? ''
    const path = `__assignment__${assignmentId}`
    tabContentsRef.current[path] = draft
    setTabs([{ path, name: 'مشق.urdu', handle: null }])
    setActiveTabPath(path)
    setCode(draft)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // postMessage bridge
  useEffect(() => {
    function handler(e: MessageEvent) {
      // Parent lesson page sends {type:"setCode", code:"..."} to pre-load an example
      if (e.data?.type === 'setCode' && typeof e.data.code === 'string') {
        const path = '__lesson__'
        const content: string = e.data.code
        tabContentsRef.current[path] = content
        setTabs(prev => prev.some(t => t.path === path)
          ? prev.map(t => t.path === path ? { ...t } : t)
          : [...prev, { path, name: 'مثال.urdu', handle: null }]
        )
        setActiveTabPath(path)
        setCode(content)
        setLines([])
        return
      }

      if (e.data?.type !== 'getCode') return
      const ap = activeTabPathRef.current
      const currentCode = ap ? (tabContentsRef.current[ap] ?? '') : ''
      const target = e.source as Window | null
      const origin = e.origin === 'null' ? '*' : e.origin
      try {
        target?.postMessage({ type: 'code', code: currentCode }, origin)
      } catch {
        window.parent.postMessage({ type: 'code', code: currentCode }, '*')
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  // ── Tab management ──────────────────────────────────────────────────────────

  function openTab(path: string, name: string, handle: FileSystemFileHandle | null, content: string) {
    // Save current tab draft
    if (activeTabPath) tabContentsRef.current[activeTabPath] = code

    const alreadyOpen = tabsRef.current.some(t => t.path === path)
    if (!alreadyOpen) {
      tabContentsRef.current[path] = content
      setTabs(prev => [...prev, { path, name, handle }])
    }

    setActiveTabPath(path)
    setCode(tabContentsRef.current[path] ?? content)
  }

  function switchToTab(path: string) {
    if (path === activeTabPath) return
    if (activeTabPath) tabContentsRef.current[activeTabPath] = code
    setActiveTabPath(path)
    setCode(tabContentsRef.current[path] ?? '')
  }

  function closeTab(path: string) {
    const current = tabsRef.current
    const filtered = current.filter(t => t.path !== path)
    delete tabContentsRef.current[path]
    setTabs(filtered)

    if (path === activeTabPath) {
      const idx = current.findIndex(t => t.path === path)
      const next = filtered[Math.min(idx, filtered.length - 1)] ?? null
      setActiveTabPath(next?.path ?? null)
      setCode(next ? (tabContentsRef.current[next.path] ?? '') : '')
    }
  }

  function handleCodeChange(value: string) {
    setCode(value)
    if (activeTabPath) {
      tabContentsRef.current[activeTabPath] = value
      // Auto-save draft when running inside edtech
      if (assignmentId && activeTabPath === `__assignment__${assignmentId}`) {
        localStorage.setItem(`ide-draft-${assignmentId}`, value)
      }
    }
  }

  // ── File operations ─────────────────────────────────────────────────────────

  function submitInput() {
    const val = inputValue
    setLines(prev => [...prev, { kind: 'input', text: val }])
    setInputValue('')
    setWaitingForInput(false)
    resolver.current.fn?.(val)
    resolver.current.fn = null
  }

  async function handleSave() {
    if ('showSaveFilePicker' in window) {
      try {
        const handle = activeTab?.handle ?? await window.showSaveFilePicker({
          ...FILE_OPTS,
          suggestedName: activeTab?.name ?? 'کوڈ.urdu',
        })
        const writable = await handle.createWritable()
        await writable.write(code)
        await writable.close()
        if (activeTabPath) {
          setTabs(prev => prev.map(t =>
            t.path === activeTabPath ? { ...t, handle, name: handle.name } : t
          ))
        }
      } catch {}
    } else {
      const blob = new Blob([code], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = activeTab?.name ?? 'کوڈ.urdu'
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  async function handleSaveAs() {
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await window.showSaveFilePicker({
          ...FILE_OPTS,
          suggestedName: activeTab?.name ?? 'کوڈ.urdu',
        })
        const writable = await handle.createWritable()
        await writable.write(code)
        await writable.close()
        if (activeTabPath) {
          setTabs(prev => prev.map(t =>
            t.path === activeTabPath ? { ...t, handle, name: handle.name } : t
          ))
        }
      } catch {}
    } else {
      handleSave()
    }
  }

  async function handleOpen() {
    if ('showOpenFilePicker' in window) {
      try {
        const handles = await window.showOpenFilePicker(FILE_OPTS)
        const handle = handles[0]
        if (!handle) return
        const file = await handle.getFile()
        const content = await file.text()
        openTab(`__picked__${handle.name}`, handle.name, handle, content)
      } catch {}
    } else {
      openInputRef.current?.click()
    }
  }

  function handleOpenFallback(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      openTab(`__picked__${file.name}`, file.name, null, reader.result as string)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function handleStop() {
    cancelledRef.current = true
    resolver.current.fn?.('')
    resolver.current.fn = null
    setWaitingForInput(false)
  }

  function makeDragHandler(onMove: (dx: number) => void) {
    return (e: React.MouseEvent) => {
      e.preventDefault()
      let last = e.clientX
      const onMouseMove = (ev: MouseEvent) => { onMove(ev.clientX - last); last = ev.clientX }
      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    }
  }

  async function handleRun() {
    setLines([])
    setRunning(true)
    setWaitingForInput(false)
    setInputValue('')
    cancelledRef.current = false
    resolver.current.fn = null
    trackEvent('code_run', { embedded: embeddedMode })

    if (apiUrl) {
      await runViaApi(apiUrl, code)
    } else {
      setLines([{ kind: 'output', text: '⚠ غلطی: سرور کا پتہ (VITE_API_URL) سیٹ نہیں ہے' }])
      setRunning(false)
    }
  }

  // ── Railway API runner ──────────────────────────────────────────────────────
  // Re-posts with collected inputs each time پڑھو() is hit, showing only
  // the new stdout delta each round so output doesn't repeat.

  async function runViaApi(apiUrl: string, currentCode: string) {
    const collectedInputs: string[] = []
    let shownStdoutLen = 0

    try {
      while (true) {
        if (cancelledRef.current) {
          setLines(prev => [...prev, { kind: 'output', text: '◼ روک دیا گیا' }])
          break
        }

        let resp: Response
        try {
          resp = await fetch(`${apiUrl}/run`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: currentCode, inputs: collectedInputs }),
          })
        } catch {
          setLines(prev => [...prev, { kind: 'output', text: '⚠ غلطی: سرور سے رابطہ نہیں ہو سکا' }])
          break
        }

        const data = await resp.json() as {
          ok: boolean
          stdout: string
          stderr: string
          needs_input: boolean
        }

        // Show only the new portion of stdout since last round
        const newOut = data.stdout.slice(shownStdoutLen)
        shownStdoutLen = data.stdout.length
        for (const line of newOut.split('\n')) {
          if (line !== '') setLines(prev => [...prev, { kind: 'output', text: line }])
        }

        if (data.needs_input) {
          // Pause and wait for the user to type
          setWaitingForInput(true)
          const userInput = await new Promise<string>(resolve => {
            resolver.current.fn = resolve
          })
          if (cancelledRef.current) {
            setLines(prev => [...prev, { kind: 'output', text: '◼ روک دیا گیا' }])
            break
          }
          collectedInputs.push(userInput)
          continue
        }

        if (!data.ok && data.stderr.trim()) {
          setLines(prev => [...prev, { kind: 'output', text: `⚠ غلطی: ${data.stderr.trim()}` }])
        }

        break
      }
    } finally {
      setRunning(false)
      setWaitingForInput(false)
    }
  }

  // ── Explorer operations ─────────────────────────────────────────────────────

  async function handleOpenFolder() {
    if (!('showDirectoryPicker' in window)) return
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
      setRootHandle(handle)
      setRootName(handle.name)
      setTree(await loadChildren(handle, handle.name))
    } catch {}
  }

  async function handleExplorerFileClick(node: FileNode) {
    if (tabsRef.current.some(t => t.path === node.path)) {
      switchToTab(node.path)
      return
    }
    try {
      const file = await node.handle.getFile()
      openTab(node.path, node.name, node.handle, await file.text())
    } catch {}
  }

  async function handleToggleDir(path: string) {
    const node = findDir(tree, path)
    if (!node) return
    if (node.expanded) {
      setTree(prev => updateDirInTree(prev, path, n => ({ ...n, expanded: false })))
    } else {
      const children = node.children.length > 0 ? node.children : await loadChildren(node.handle, node.path)
      setTree(prev => updateDirInTree(prev, path, n => ({ ...n, expanded: true, children })))
    }
  }

  async function handleNewFile(dirHandle: FileSystemDirectoryHandle, dirPath: string) {
    const name = window.prompt('فائل کا نام:')
    if (!name) return
    const fname = name.endsWith('.urdu') ? name : `${name}.urdu`
    try {
      const newHandle = await dirHandle.getFileHandle(fname, { create: true })
      const writable = await newHandle.createWritable()
      await writable.write('')
      await writable.close()
      openTab(`${dirPath}/${fname}`, fname, newHandle, '')
      await handleRefresh()
    } catch {}
  }

  function handleNewFileBlank() {
    const path = `__untitled_${++untitledCounter}`
    openTab(path, 'بے نام.urdu', null, '')
  }

  function handleResetSample() {
    if (!activeTabPath?.startsWith('__sample__')) return
    const sample = SAMPLE_PROGRAMS.find(s => `__sample__${s.file}` === activeTabPath)
    if (!sample) return
    tabContentsRef.current[activeTabPath] = sample.code
    setCode(sample.code)
    setLines([])
  }

  function handleCopyOutput() {
    navigator.clipboard.writeText(lines.map(l => (l.kind === 'input' ? `← ${l.text}` : l.text)).join('\n'))
  }

  async function handleDeleteNode(node: TreeNode) {
    if (!window.confirm(`"${node.name}" کو حذف کریں؟`)) return
    try {
      await node.parentHandle.removeEntry(node.name, { recursive: true })
      const toClose = tabsRef.current.filter(
        t => t.path === node.path || t.path.startsWith(node.path + '/')
      )
      toClose.forEach(t => closeTab(t.path))
      await handleRefresh()
    } catch {}
  }

  async function handleRefresh() {
    if (!rootHandle) return
    setTree(await loadChildren(rootHandle, rootHandle.name))
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  function getCurrentCode() {
    return activeTabPath ? (tabContentsRef.current[activeTabPath] ?? code) : code
  }

  return (
    <div className="h-screen bg-gray-950 text-white flex flex-col overflow-hidden">

      {feedbackOpen && (
        <FeedbackModal
          onClose={() => setFeedbackOpen(false)}
          getCurrentCode={getCurrentCode}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-gray-900 border-b border-gray-800 shrink-0" dir="rtl">
        <div className="flex items-center gap-3">
          <a
            href="https://nuqta.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="text-base font-bold tracking-wide text-blue-400 hover:text-blue-300 transition-colors"
          >
            نقطہ اڈا
          </a>
          {/* Student name badge — only shown when embedded in edtech */}
          {embeddedMode && studentNameParam && (
            <span className="text-xs text-green-400 bg-green-950 px-2 py-0.5 rounded border border-green-800">
              {studentNameParam}
            </span>
          )}
          {/* Feedback button — always visible */}
          <button
            onClick={() => setFeedbackOpen(true)}
            className="text-xs text-gray-500 hover:text-gray-300 border border-gray-700 hover:border-gray-500 px-2.5 py-1 rounded transition-colors"
            title="تاثر یا غلطی رپورٹ"
          >
            تاثر
          </button>
          {/* Reset — only meaningful for a sample program, restores its original code */}
          {activeTabPath?.startsWith('__sample__') && (
            <button
              onClick={handleResetSample}
              className="text-xs text-gray-500 hover:text-gray-300 border border-gray-700 hover:border-gray-500 px-2.5 py-1 rounded transition-colors"
              title="نمونہ اصل حالت میں واپس لائیں"
            >
              بحال کریں
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRun}
            disabled={running || activeTabPath === null}
            className="px-5 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded text-sm font-semibold transition-colors"
          >
            {running ? 'چل رہا ہے...' : 'چلاؤ ◀'}
          </button>
          {running && (
            <button onClick={handleStop} className="px-4 py-1.5 bg-red-700 hover:bg-red-600 rounded text-sm font-semibold transition-colors">
              روکیں ◼
            </button>
          )}
          {activeTabPath !== null && !embeddedMode && (
            <>
              <button onClick={handleSave} className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm font-semibold transition-colors">
                محفوظ کریں
              </button>
              <button onClick={handleSaveAs} className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm font-semibold transition-colors">
                نئے نام سے
              </button>
            </>
          )}
          {!embeddedMode && (
            <button onClick={handleOpen} className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm font-semibold transition-colors">
              کھولیں
            </button>
          )}
        </div>
      </div>

      {/* Hidden fallback file input */}
      <input ref={openInputRef} type="file" accept=".urdu,.txt" className="hidden" onChange={handleOpenFallback} />

      {/* Main body: Explorer | Content */}
      <div className="flex flex-1 overflow-hidden">

        {/* Explorer — hidden in embedded mode */}
        {!embeddedMode && (
          <>
            <div style={{ width: explorerWidth }} className="shrink-0 border-r border-gray-800 overflow-hidden flex flex-col">
              <Explorer
                rootName={rootName}
                rootHandle={rootHandle}
                tree={tree}
                activeFilePath={activeTabPath}
                onFileClick={handleExplorerFileClick}
                onToggleDir={handleToggleDir}
                onOpenFolder={handleOpenFolder}
                onOpenFile={handleOpen}
                onNewFile={handleNewFile}
                onNewFileBlank={handleNewFileBlank}
                onDeleteNode={handleDeleteNode}
                onRefresh={handleRefresh}
              />
            </div>
            <div
              onMouseDown={makeDragHandler(dx => setExplorerWidth(w => Math.max(150, Math.min(480, w - dx))))}
              className="w-1 shrink-0 bg-gray-800 hover:bg-blue-500 active:bg-blue-400 cursor-col-resize transition-colors z-10"
            />
          </>
        )}

        {activeTabPath === null ? (
          /* Welcome screen */
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8 overflow-y-auto" dir="rtl">
            <div className="max-w-sm w-full">
              <p className="text-gray-300 text-base font-semibold mb-1">اردو اڈا میں خوش آمدید</p>
              <p className="text-gray-600 text-xs mb-5">شروع کرنے کے لیے ایک آپشن منتخب کریں</p>

              {/* Action buttons */}
              <div className="flex flex-col gap-2 mb-6">
                <button onClick={handleNewFileBlank} className="px-5 py-2 bg-green-700 hover:bg-green-600 rounded text-sm text-white transition-colors">
                  نئی فائل بنائیں
                </button>
                <button onClick={handleOpen} className="px-5 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white transition-colors">
                  فائل کھولیں
                </button>
                {('showDirectoryPicker' in window) && (
                  <button onClick={handleOpenFolder} className="px-5 py-2 bg-blue-700 hover:bg-blue-600 rounded text-sm text-white transition-colors">
                    فولڈر کھولیں
                  </button>
                )}
              </div>

              {/* Sample programs */}
              <div className="border-t border-gray-800 pt-4">
                <p className="text-gray-500 text-xs mb-3">نمونہ پروگرام</p>
                <div className="flex flex-col gap-1.5">
                  {SAMPLE_PROGRAMS.map(sample => (
                    <button
                      key={sample.file}
                      onClick={() => openTab(`__sample__${sample.file}`, sample.file, null, sample.code)}
                      className="flex items-center justify-between px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm text-gray-200 transition-colors group"
                    >
                      <span className="text-gray-500 text-xs group-hover:text-gray-400 font-mono">.urdu</span>
                      <span>{sample.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Editor panel — first in DOM = right side in RTL flex */}
            <div className="flex-1 flex flex-col">
              {/* Tab bar */}
              <div className="flex items-center bg-gray-900 border-b border-gray-800 overflow-x-auto shrink-0">
                {tabs.map(tab => (
                  <div
                    key={tab.path}
                    className={`flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer border-r border-gray-800 shrink-0 select-none ${
                      activeTabPath === tab.path
                        ? 'bg-gray-950 text-white border-t-2 border-t-blue-500'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                    }`}
                    onClick={() => switchToTab(tab.path)}
                  >
                    <span className="max-w-[140px] truncate">{tab.name}</span>
                    {!embeddedMode && (
                      <button
                        onClick={e => { e.stopPropagation(); closeTab(tab.path) }}
                        className="text-gray-500 hover:text-red-400 leading-none shrink-0"
                      >×</button>
                    )}
                  </div>
                ))}
                {!embeddedMode && (
                  <button
                    onClick={handleNewFileBlank}
                    className="px-3 py-1.5 text-gray-500 hover:text-white text-sm shrink-0"
                    title="نئی فائل"
                  >+</button>
                )}
              </div>
              <div className="flex-1 overflow-hidden">
                <Editor value={code} onChange={handleCodeChange} />
              </div>
            </div>

            {/* Drag handle between editor and output */}
            <div
              onMouseDown={makeDragHandler(dx => setOutputWidth(w => Math.max(200, Math.min(640, w + dx))))}
              className="w-1 shrink-0 bg-gray-800 hover:bg-blue-500 active:bg-blue-400 cursor-col-resize transition-colors z-10"
            />

            {/* Output panel */}
            <div style={{ width: outputWidth }} className="shrink-0 flex flex-col border-r border-gray-800">
              <div className="flex items-center justify-between px-4 py-1.5 bg-gray-900 border-b border-gray-800 shrink-0" dir="rtl">
                <span className="text-xs text-gray-500">نتیجہ</span>
                {lines.length > 0 && (
                  <button
                    onClick={handleCopyOutput}
                    className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                    title="نتیجہ کاپی کریں"
                  >
                    کاپی کریں
                  </button>
                )}
              </div>
              <div dir="rtl" className="flex-1 bg-gray-900 font-mono text-sm p-4 overflow-y-auto">
                {lines.length === 0 && !running && (
                  <p className="text-gray-600 text-xs">کوڈ چلانے کے لیے چلاؤ دبائیں</p>
                )}
                {lines.map((line, i) => (
                  <div key={i} className={line.kind === 'input' ? 'text-green-400' : 'text-gray-100'}>
                    {line.kind === 'input' ? `← ${line.text}` : line.text}
                  </div>
                ))}
                {waitingForInput && (
                  <div className="flex flex-col gap-1">
                    <span className="text-gray-500 text-xs">درج کریں اور انٹر دبائیں</span>
                    <div className="flex items-center gap-1 text-green-400">
                      <span>←</span>
                      <input
                        ref={inputRef}
                        value={inputValue}
                        onChange={e => setInputValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') submitInput() }}
                        dir="rtl"
                        autoComplete="off"
                        spellCheck={false}
                        className="bg-transparent outline-none flex-1 caret-green-400"
                      />
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
