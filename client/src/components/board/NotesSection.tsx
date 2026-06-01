import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { JobNote, BoardUser } from '../../types/board'

interface Props {
  notes: JobNote[]
  activeUser: BoardUser | null
  onAddNote: (text: string) => void
  onDeleteNote: (noteId: string) => void
  isSubmitting?: boolean
}

export default function NotesSection({ notes, activeUser, onAddNote, onDeleteNote, isSubmitting }: Props) {
  const [draft, setDraft] = useState('')

  const sorted = [...notes].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )

  const handleSend = () => {
    const text = draft.trim()
    if (!text || isSubmitting) return
    onAddNote(text)
    setDraft('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSend()
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-slate-300 font-semibold text-sm">Notes</span>
        <span className="bg-slate-700 rounded-full px-2 text-xs text-slate-400">
          {notes.length}
        </span>
      </div>

      {/* Notes list */}
      {sorted.length > 0 ? (
        <div>
          {sorted.map((note) => (
            <div key={note.id} className="border-l-2 border-slate-700 pl-3 py-1 mb-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-baseline gap-1 min-w-0">
                  <span className="font-semibold text-slate-300 text-sm truncate">
                    {note.authorName}
                  </span>
                  <span className="text-slate-500 text-xs shrink-0">
                    &middot;{' '}
                    {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                  </span>
                </div>
                {activeUser?.id === note.authorId && (
                  <button
                    onClick={() => onDeleteNote(note.id)}
                    className="text-slate-600 hover:text-red-400 text-xs shrink-0 leading-none"
                    aria-label="Delete note"
                  >
                    &times;
                  </button>
                )}
              </div>
              <p className="text-slate-400 text-sm leading-relaxed mt-0.5">{note.text}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-slate-600 text-sm italic">No notes yet</p>
      )}

      {/* Composer */}
      {activeUser ? (
        <div className="flex flex-col gap-2">
          <textarea
            className="bg-slate-900 border border-slate-700 text-slate-300 rounded p-2 text-sm w-full resize-none focus:outline-none focus:border-slate-500"
            rows={3}
            placeholder={`Add a note as ${activeUser.name}...`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="flex justify-end">
            <button
              onClick={handleSend}
              disabled={!draft.trim() || isSubmitting}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-slate-600 text-xs italic">
          &larr; Select a user in the Users tab to add notes
        </p>
      )}
    </div>
  )
}
