export interface FileNode {
  kind: 'file'
  name: string
  path: string
  handle: FileSystemFileHandle
  parentHandle: FileSystemDirectoryHandle
}

export interface DirNode {
  kind: 'dir'
  name: string
  path: string
  handle: FileSystemDirectoryHandle
  parentHandle: FileSystemDirectoryHandle
  children: TreeNode[]
  expanded: boolean
}

export type TreeNode = FileNode | DirNode

export interface OpenTab {
  path: string
  name: string
  handle: FileSystemFileHandle | null
  content: string
  dirty: boolean
}
