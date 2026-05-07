import { useState, useRef } from 'react'
import toast from 'react-hot-toast'
import Button from './Button'
import { uploadSatPhotos } from '../api/sat.api'

interface PhotoUploadProps {
  ticketId: string
  onUploadComplete: (urls: string[]) => void
}

export default function PhotoUpload({ ticketId, onUploadComplete }: PhotoUploadProps) {
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFiles(selected: FileList | null) {
    if (!selected) return
    const arr = Array.from(selected).slice(0, 5)
    const tooBig = arr.filter((f) => f.size > 5 * 1024 * 1024)
    if (tooBig.length) {
      toast.error(`${tooBig.length} file(s) exceed 5MB limit`)
      return
    }
    setFiles(arr)
    setPreviews(arr.map((f) => URL.createObjectURL(f)))
  }

  function removeFile(i: number) {
    URL.revokeObjectURL(previews[i])
    setFiles((prev) => prev.filter((_, fi) => fi !== i))
    setPreviews((prev) => prev.filter((_, pi) => pi !== i))
  }

  async function handleUpload() {
    if (!files.length) return
    setUploading(true)
    try {
      const urls = await uploadSatPhotos(ticketId, files)
      onUploadComplete(urls)
      toast.success(`${files.length} photo${files.length > 1 ? 's' : ''} uploaded`)
      previews.forEach((p) => URL.revokeObjectURL(p))
      setFiles([])
      setPreviews([])
    } catch {
      toast.error('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    handleFiles(e.dataTransfer.files)
  }

  return (
    <div className="space-y-3">
      <div
        className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <div className="text-3xl mb-2">📸</div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Click or drag photos here
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Max 5 files · Max 5MB each · JPG, PNG, WEBP
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {previews.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-2">
            {previews.map((src, i) => (
              <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800">
                <img src={src} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeFile(i) }}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center leading-none"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <Button fullWidth loading={uploading} onClick={handleUpload}>
            Upload {files.length} photo{files.length > 1 ? 's' : ''}
          </Button>
        </>
      )}
    </div>
  )
}
