import {
  BookOpen,
  Search,
  ChevronDown,
  ChevronRight,
  Layers,
  LockKeyhole,
  X,
} from "lucide-react";
import type { AnatomyAsset } from "../atlas/types";
import type { Catalog } from "../content/catalog";
import { normalizeSearch } from "../content/catalog";
import { useMemo, useState } from "react";

export default function Sidebar({
  catalog,
  moduleId,
  setModule,
  selectedId,
  onSelect,
  onCoverage,
  open,
  onClose,
}: {
  catalog: Catalog;
  moduleId: string;
  setModule: (id: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCoverage: () => void;
  open: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const searched = useMemo(
    () =>
      catalog.assets.filter((a) =>
        query
          ? normalizeSearch(
              [a.name, a.nameEn, ...a.aliases].join(" "),
            ).includes(normalizeSearch(query))
          : a.moduleId === moduleId,
      ),
    [catalog, moduleId, query],
  );
  const shown = searched.filter((a) => query || a.hemisphere !== "right");
  function select(asset: AnatomyAsset) {
    onSelect(asset.id);
    onClose();
  }
  return (
    <aside
      className={`sidebar ${open ? "is-open" : ""}`}
      aria-label="Navegação anatômica"
    >
      <div className="sidebar-heading">
        <span>SEU ATLAS</span>
        <button
          className="icon-button mobile-only"
          aria-label="Fechar módulos"
          onClick={onClose}
        >
          <X size={20} />
        </button>
        <BookOpen size={16} />
      </div>
      <label className="search-field">
        <Search size={17} />
        <input
          placeholder="Buscar estrutura…"
          aria-label="Buscar estrutura"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button aria-label="Limpar busca" onClick={() => setQuery("")}>
            <X size={14} />
          </button>
        )}
      </label>
      <nav className="module-list" aria-label="Módulos">
        {catalog.modules.map((module) => {
          const count = catalog.assets.filter(
            (a) => a.moduleId === module.id,
          ).length;
          return (
            <div key={module.id}>
              <button
                className={`module-button ${module.id === moduleId ? "selected" : ""}`}
                onClick={() => {
                  setModule(module.id);
                  setQuery("");
                }}
              >
                <Layers size={16} />
                <span>{module.shortName}</span>
                {count ? (
                  <small>{count}</small>
                ) : (
                  <LockKeyhole size={13} />
                )}{" "}
                {module.id === moduleId ? (
                  <ChevronDown size={13} />
                ) : (
                  <ChevronRight size={13} />
                )}
              </button>
              {module.id === moduleId && !query && (
                <div className="module-description">
                  {module.subtitle}
                  {!count && (
                    <button className="text-button" onClick={onCoverage}>
                      Ver cobertura do roteiro
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      <div className="sidebar-heading structures-heading">
        <span>{query ? "RESULTADOS" : "ESTRUTURAS"}</span>
        <small>{shown.length}</small>
      </div>
      <div className="structure-list">
        {shown.length ? (
          shown.map((asset) => (
            <button
              key={asset.id}
              className={`structure-button ${selectedId === asset.id ? "active" : ""}`}
              onClick={() => select(asset)}
            >
              <span className="color-dot" style={{ background: asset.color }} />
              <span>{asset.name}</span>
            </button>
          ))
        ) : (
          <p className="muted empty-results">
            {query
              ? "Nenhuma estrutura encontrada. Tente outro termo."
              : "Este módulo aguarda representação compatível. Os itens do roteiro estão na matriz de cobertura."}
          </p>
        )}
      </div>
      <button className="coverage-callout" onClick={onCoverage}>
        <BookOpen size={19} />
        <span>
          <strong>O roteiro, por inteiro</strong>
          <small>{catalog.curriculumCount} itens · veja a cobertura real</small>
        </span>
        <ChevronRight size={16} />
      </button>
    </aside>
  );
}
