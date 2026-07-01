interface FilePickerAcceptType {
  description?: string
  accept: Record<string, `.${string}`[]>
}

interface SaveFilePickerOptions {
  suggestedName?: string
  types?: FilePickerAcceptType[]
}

interface OpenFilePickerOptions {
  multiple?: boolean
  types?: FilePickerAcceptType[]
}

interface DirectoryPickerOptions {
  mode?: 'read' | 'readwrite'
}

interface FileSystemWritableFileStream {
  write(data: string | BufferSource | Blob): Promise<void>
  close(): Promise<void>
}

interface FileSystemHandle {
  readonly kind: 'file' | 'directory'
  readonly name: string
}

interface FileSystemFileHandle extends FileSystemHandle {
  readonly kind: 'file'
  getFile(): Promise<File>
  createWritable(): Promise<FileSystemWritableFileStream>
}

interface FileSystemDirectoryHandle extends FileSystemHandle {
  readonly kind: 'directory'
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>
}

interface Window {
  showSaveFilePicker(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>
  showOpenFilePicker(options?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>
  showDirectoryPicker(options?: DirectoryPickerOptions): Promise<FileSystemDirectoryHandle>
}
