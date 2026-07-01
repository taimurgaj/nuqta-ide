import { useState } from 'react'
import { type TreeNode, type FileNode } from '../types'

interface Props {
  rootName: string | null
  rootHandle: FileSystemDirectoryHandle | null
  tree: TreeNode[]
  activeFilePath: string | null
  onFileClick: (node: FileNode) => void
  onToggleDir: (path: string) => void
  onOpenFolder: () => void
  onOpenFile: () => void
  onNewFile: (dirHandle: FileSystemDirectoryHandle, dirPath: string) => void
  onNewFileBlank: () => void
  onDeleteNode: (node: TreeNode) => void
  onRefresh: () => void
}

interface NodeItemProps {
  node: TreeNode
  depth: number
  activeFilePath: string | null
  onFileClick: (node: FileNode) => void
  onToggleDir: (path: string) => void
  onNewFile: (dirHandle: FileSystemDirectoryHandle, dirPath: string) => void
  onDeleteNode: (node: TreeNode) => void
}

function NodeItem({ node, depth, activeFilePath, onFileClick, onToggleDir, onNewFile, onDeleteNode }: NodeItemProps) {
  const [hovered, setHovered] = useState(false)
  const indent = depth * 12

  if (node.kind === 'file') {
    const isActive = activeFilePath === node.path
    return (
      <div
        style={{ paddingLeft: `${indent + 24}px` }}
        className={`flex items-center py-[3px] pr-2 cursor-pointer text-xs select-none group ${
          isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'
        }`}
        onClick={() => onFileClick(node)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        title={node.name}
      >
        <span className={`mr-1.5 text-[10px] shrink-0 ${isActive ? 'text-blue-200' : 'text-gray-500'}`}>&#xB7;</span>
        <span className="truncate flex-1">{node.name}</span>
        {hovered && (
          <button
            onClick={e => { e.stopPropagation(); onDeleteNode(node) }}
            className={`px-1 shrink-0 leading-none ${isActive ? 'text-blue-200 hover:text-white' : 'text-gray-500 hover:text-red-400'}`}
            title="حذف کریں"
          >&#x2715;</button>
        )}
      </div>
    )
  }

  return (
    <div>
      <div
        style={{ paddingLeft: `${indent + 4}px` }}
        className="flex items-center py-[3px] pr-2 cursor-pointer text-xs text-gray-300 hover:bg-gray-800 select-none"
        onClick={() => onToggleDir(node.path)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <span className="mr-1 text-gray-500 w-3 shrink-0 text-[10px]">
          {node.expanded ? '▾' : '▸'}
        </span>
        <span className="truncate flex-1 text-gray-200">{node.name}</span>
        {hovered && (
          <>
            <button
              onClick={e => { e.stopPropagation(); onNewFile(node.handle, node.path) }}
              className="text-gray-400 hover:text-white px-1 shrink-0 leading-none"
              title="نئی فائل"
            >+</button>
            <button
              onClick={e => { e.stopPropagation(); onDeleteNode(node) }}
              className="text-gray-500 hover:text-red-400 px-1 shrink-0 leading-none"
              title="حذف کریں"
            >&#x2715;</button>
          </>
        )}
      </div>
      {node.expanded && node.children.map(child => (
        <NodeItem
          key={child.path}
          node={child}
          depth={depth + 1}
          activeFilePath={activeFilePath}
          onFileClick={onFileClick}
          onToggleDir={onToggleDir}
          onNewFile={onNewFile}
          onDeleteNode={onDeleteNode}
        />
      ))}
    </div>
  )
}

const supportsDir = 'showDirectoryPicker' in window

export default function Explorer({
  rootName,
  rootHandle,
  tree,
  activeFilePath,
  onFileClick,
  onToggleDir,
  onOpenFolder,
  onOpenFile,
  onNewFile,
  onNewFileBlank,
  onDeleteNode,
  onRefresh,
}: Props) {
  return (
    <div className="w-full h-full flex flex-col bg-gray-900 overflow-hidden">

      {/* Panel header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800 shrink-0">
        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">فائل خانہ</span>
        {rootName && (
          <button
            onClick={onRefresh}
            className="text-gray-500 hover:text-white text-sm leading-none px-1"
            title="تازہ کریں"
          >↺</button>
        )}
      </div>

      {rootName ? (
        <div className="flex-1 overflow-y-auto">
          {/* Root folder row */}
          <div className="flex items-center justify-between px-3 py-1.5">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider truncate">
              {rootName}
            </span>
            {rootHandle && (
              <button
                onClick={() => onNewFile(rootHandle, rootName)}
                className="text-gray-500 hover:text-white text-sm leading-none px-1 shrink-0"
                title="نئی فائل"
              >+</button>
            )}
          </div>

          {tree.length === 0 ? (
            <p className="px-3 py-2 text-xs text-gray-600">فولڈر خالی ہے</p>
          ) : (
            tree.map(node => (
              <NodeItem
                key={node.path}
                node={node}
                depth={0}
                activeFilePath={activeFilePath}
                onFileClick={onFileClick}
                onToggleDir={onToggleDir}
                onNewFile={onNewFile}
                onDeleteNode={onDeleteNode}
              />
            ))
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">شروع کریں</p>
          <button
            onClick={onNewFileBlank}
            className="px-3 py-1.5 bg-green-700 hover:bg-green-600 rounded text-xs text-white transition-colors w-full"
          >
            نئی فائل بنائیں
          </button>
          <button
            onClick={onOpenFile}
            className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded text-xs text-white transition-colors w-full"
          >
            فائل کھولیں
          </button>
          {supportsDir && (
            <button
              onClick={onOpenFolder}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-xs text-white transition-colors w-full"
            >
              فولڈر کھولیں
            </button>
          )}
        </div>
      )}

    </div>
  )
}
