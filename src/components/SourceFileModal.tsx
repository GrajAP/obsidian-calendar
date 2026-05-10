interface SourceFileModalProps {
  path: string;
  title: string;
  content: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onReload: () => void;
  onFormatYaml: () => void;
  onClose: () => void;
  saving: boolean;
}

const SourceFileModal = ({
  path,
  title,
  content,
  onChange,
  onSave,
  onReload,
  onFormatYaml,
  onClose,
  saving
}: SourceFileModalProps) => (
  <div className="modal-scrim" onClick={onClose}>
    <section className="source-file-modal" onClick={event => event.stopPropagation()}>
      <header className="form-header">
        <div>
          <p>Plik źródłowy .md</p>
          <h2>{title}</h2>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} title="Zamknij">×</button>
      </header>

      <div className="source-file-path">{path}</div>

      <label className="form-group source-file-group">
        <span>Zawartość</span>
        <textarea value={content} onChange={event => onChange(event.target.value)} spellCheck={false} />
      </label>

      <footer className="form-actions">
        <button type="button" className="secondary-btn" onClick={onReload}>Przywróć z dysku</button>
        <button type="button" className="secondary-btn" onClick={onFormatYaml}>Format YAML</button>
        <button type="button" className="secondary-btn" onClick={onClose}>Zamknij</button>
        <button type="button" className="primary-btn" onClick={onSave} disabled={saving}>{saving ? 'Zapisywanie...' : 'Zapisz plik'}</button>
      </footer>
    </section>
  </div>
);

export default SourceFileModal;
