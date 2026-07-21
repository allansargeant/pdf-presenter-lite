interface Props {
  currentPage: number
  totalPages: number
  onPrev: () => void
  onNext: () => void
}

function Transport({ currentPage, totalPages, onPrev, onNext }: Props): React.JSX.Element {
  return (
    <div className="transport">
      <button className="transport-btn" disabled={currentPage <= 1} onClick={onPrev}>
        ◀ Previous
      </button>
      <div className="transport-indicator">
        {totalPages ? `${currentPage} / ${totalPages}` : '— / —'}
      </div>
      <button className="transport-btn" disabled={currentPage >= totalPages} onClick={onNext}>
        Next ▶
      </button>
    </div>
  )
}

export default Transport
