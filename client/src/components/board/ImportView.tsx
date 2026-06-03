import { useState, useRef } from 'react'
import { useImportJobs } from '../../hooks/useBoard'

export default function ImportView() {
  const importJobs = useImportJobs()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(e.target.files?.[0] ?? null)
    importJobs.reset()
  }

  const handleImport = () => {
    if (!selectedFile) return
    importJobs.mutate(selectedFile)
  }

  const importResult = importJobs.data as {
    imported: number
    shippedApplied: number
    skipped: number
    warnings: string[]
    rowErrors: string[]
  } | undefined
  const importError = importJobs.error as Error | null

  return (
    <div className="max-w-lg px-4 py-6">
      <h2 className="text-slate-200 font-semibold text-base mb-1">Import Jobs</h2>
      <p className="text-slate-500 text-sm mb-3">
        Upload an XLSM or XLSX file exported from your project tracking spreadsheet.
        This replaces all current jobs.
      </p>
      <p className="text-slate-600 text-xs mb-6 leading-relaxed">
        <span className="text-slate-500 font-medium">Status column:</span> only rows marked{' '}
        <span className="text-slate-400">Shipped</span> are moved to Archive on import.
        Other spreadsheet statuses (Ready to Ship, On Hold, Build, etc.) are ignored — set
        workflow status on each job card after import.
      </p>

      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-3">
          <label className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm px-4 py-2 rounded-lg cursor-pointer transition-colors">
            Choose File
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsm,.xlsx"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>
          <span className="text-slate-400 text-sm truncate">
            {selectedFile ? selectedFile.name : 'No file selected'}
          </span>
        </div>

        <button
          onClick={handleImport}
          disabled={!selectedFile || importJobs.isPending}
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-5 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {importJobs.isPending ? 'Importing…' : 'Import Jobs'}
        </button>

        {importJobs.isSuccess && importResult && (() => {
          const hadProblems = importResult.skipped > 0 || importResult.rowErrors.length > 0
          return (
            <div className="pt-1 space-y-2">
              <p className={hadProblems ? 'text-amber-400 text-sm font-medium' : 'text-green-400 text-sm font-medium'}>
                {hadProblems ? '⚠ ' : '✓ '}
                Imported {importResult.imported} job{importResult.imported !== 1 ? 's' : ''}
                {importResult.skipped > 0 && (
                  <span className="ml-2 text-amber-400">
                    ({importResult.skipped} row{importResult.skipped !== 1 ? 's' : ''} skipped)
                  </span>
                )}
                {importResult.shippedApplied > 0 && (
                  <span className="ml-2 text-slate-400">
                    ({importResult.shippedApplied} archived as shipped)
                  </span>
                )}
              </p>
              {importResult.rowErrors.length > 0 && (
                <ul className="list-disc list-inside text-amber-400 text-xs space-y-0.5 max-h-40 overflow-auto">
                  {importResult.rowErrors.slice(0, 50).map((e, i) => (
                    <li key={e + i}>{e}</li>
                  ))}
                  {importResult.rowErrors.length > 50 && (
                    <li className="text-slate-500">...and {importResult.rowErrors.length - 50} more</li>
                  )}
                </ul>
              )}
              {importResult.warnings.length > 0 && (
                <ul className="list-disc list-inside text-amber-400 text-xs space-y-0.5">
                  {importResult.warnings.map((w, i) => (
                    <li key={w + i}>{w}</li>
                  ))}
                </ul>
              )}
            </div>
          )
        })()}

        {importError && (
          <p className="text-red-400 text-sm">{importError.message}</p>
        )}
      </div>
    </div>
  )
}
