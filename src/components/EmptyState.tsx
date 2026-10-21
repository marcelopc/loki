// Shown when no repository is open.

import { useRepo } from "../state/RepoContext";

export function EmptyState() {
  const { openRepo } = useRepo();
  return (
    <div className="empty-state">
      <div className="empty-icon">⎇</div>
      <h2>Nenhum repositório aberto</h2>
      <p>Abra uma pasta que contenha um repositório Git para começar.</p>
      <button className="btn primary" onClick={openRepo}>
        Abrir repositório
      </button>
    </div>
  );
}