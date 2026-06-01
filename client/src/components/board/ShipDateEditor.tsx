import React from 'react'

interface Props {
  jobNumber: string
  effectiveShipDate: string | null
  shipDateOverridden: boolean
  disabled: boolean
  onDateChange: (date: string | null) => void
}

export default function ShipDateEditor({
  jobNumber,
  effectiveShipDate,
  shipDateOverridden,
  disabled,
  onDateChange,
}: Props) {
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    onDateChange(value || null)
  }

  const handleReset = () => {
    onDateChange(null)
  }

  return (
    <div className={`flex items-center gap-3 ${disabled ? 'opacity-50' : ''}`}>
      <label className="text-slate-400 text-sm">Ship Date:</label>
      <input
        type="date"
        value={effectiveShipDate ?? ''}
        onChange={handleDateChange}
        readOnly={disabled}
        disabled={disabled}
        className="bg-slate-800 border border-slate-700 text-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
        aria-label={`Ship date for Job ${jobNumber}`}
      />
      {!disabled && shipDateOverridden && (
        <>
          <span className="bg-amber-900/40 text-amber-400 text-xs px-2 py-0.5 rounded">⚠ Overridden</span>
          <button
            onClick={handleReset}
            className="text-slate-500 hover:text-slate-300 text-xs transition-colors cursor-pointer"
            aria-label={`Reset ship date for Job ${jobNumber}`}
          >
            Reset
          </button>
        </>
      )}
    </div>
  )
}
