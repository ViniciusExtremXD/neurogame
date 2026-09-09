import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Check,
  CircleDashed,
  ExternalLink,
  Search,
} from "lucide-react";
import type { Catalog } from "../content/catalog";
import { normalizeSearch } from "../content/catalog";
interface CurriculumItem {
  id: string;
  name: string;
  originalName: string;
  moduleId: string;
  category: string;
  context: string[];
  sourcePages: number[];
  description: { summary: string } | null;
  coverage: { visual3d: boolean; visual2d: boolean; assessment: boolean };
  pending: string[];
}
export default function CoveragePage({
  catalog,
  onExplore,
}: {
  catalog: Catalog;
  onExplore: (id: string) => void;
}) {
  const [items, setItems] = useState<CurriculumItem[]>([]);
  const [query, setQuery] = useState("");
  const [module, setModule] = useState("all");
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch(import.meta.env.BASE_URL + "content/curriculum.json", {
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((data) => setItems(data.items))
      .catch(() => {
        if (!controller.signal.aborted)
          setError("Não foi possível carregar o inventário.");
      });
    return () => controller.abort();
  }, []);
  const shown = useMemo(
    () =>
      items.filter(
        (i) =>
          (module === "all" || i.moduleId === module) &&
          normalizeSearch(i.name + " " + i.context.join(" ")).includes(
            normalizeSearch(query),
          ) &&
          (filter === "all" ||
            (filter === "visual" ? i.coverage.visual3d : !i.coverage.visual3d)),
      ),
    [items, module, query, filter],
  );
  return (
    <div className="coverage-page">
      <span className="eyebrow">TRANSPARÊNCIA FAZ PARTE DO ESTUDO</span>
      <h1>O roteiro, por inteiro.</h1>
      <p className="page-intro">
        Cada item mantém seu contexto e a página de origem. Ter uma entrada no
        catálogo não significa ter uma estrutura disponível para avaliação.
      </p>
      <div className="coverage-stats">
        <div>
          <strong>{catalog.curriculumCount}</strong>
          <span>itens documentados</span>
          <small>
            {catalog.occurrenceCount} ocorrências · 10 páginas lidas
          </small>
        </div>
        <div>
          <strong>{catalog.visualCount}</strong>
          <span>itens com correspondência visual exata</span>
          <small>de {catalog.curriculumCount} itens contextuais</small>
        </div>
        <div>
          <strong>{catalog.assessmentCount}</strong>
          <span>itens cobertos pelas perguntas beta</span>
          <small>
            {catalog.assets.filter((a) => a.eligible).length} alvos, incluindo
            lateralidade
          </small>
        </div>
      </div>
      <div className="info-note">
        <BookOpen size={20} />
        <p>
          <strong>Revisão anatômica humana pendente.</strong> Correspondência
          técnica conferida não equivale a aprovação do professor. TC,
          vascularização, meninges e a medula completa precisam de ativos
          licenciados e mapeados adicionais. Os PDFs de referência não são
          distribuídos.
        </p>
      </div>
      <div className="coverage-filters">
        <label className="search-field">
          <Search size={17} />
          <input
            aria-label="Buscar no roteiro"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar no roteiro…"
          />
        </label>
        <select
          aria-label="Módulo do roteiro"
          value={module}
          onChange={(e) => setModule(e.target.value)}
        >
          <option value="all">Todos os módulos</option>
          {catalog.modules
            .filter((m) => m.items)
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
        </select>
        <select
          aria-label="Disponibilidade"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">Toda a cobertura</option>
          <option value="visual">Com visualização</option>
          <option value="missing">Lacunas visuais</option>
        </select>
      </div>
      <p className="muted">
        {shown.length} itens nesta seleção. Estruturas, conjuntos e termos
        gerais têm categorias distintas; os totais não são uma contagem de
        órgãos independentes.
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="coverage-table">
        <div className="coverage-row table-header">
          <span>Item e contexto</span>
          <span>Fonte</span>
          <span>3D</span>
          <span>2D</span>
          <span>Questões</span>
        </div>
        {shown.map((item) => {
          const asset = catalog.assets.find((a) =>
            a.curriculumIds.includes(item.id),
          );
          return (
            <details key={item.id}>
              <summary className="coverage-row">
                <div>
                  <strong>{item.name}</strong>
                  <small>{item.context.join(" › ")}</small>
                </div>
                <span>
                  Roteiro
                  <br />
                  p. {item.sourcePages.join(", ")}
                </span>
                {[
                  item.coverage.visual3d,
                  item.coverage.visual2d,
                  item.coverage.assessment,
                ].map((value, i) => (
                  <span
                    key={i}
                    className={value ? "status-yes" : "status-no"}
                    title={value ? "Disponível em beta" : "Pendente"}
                    aria-label={value ? "Disponível em beta" : "Pendente"}
                  >
                    {value ? <Check size={16} /> : <CircleDashed size={16} />}
                  </span>
                ))}
              </summary>
              <div className="coverage-detail">
                <p>
                  <strong>Nome original:</strong> {item.originalName} ·{" "}
                  {item.category}
                </p>
                <p>
                  {item.description?.summary ||
                    "Descrição referenciada ainda não disponível."}
                </p>
                {!item.coverage.visual3d && (
                  <p>
                    Representação compatível e mapeamento exato ainda não
                    disponíveis.
                  </p>
                )}
                {asset && (
                  <button
                    className="text-button"
                    onClick={() => onExplore(asset.id)}
                  >
                    Abrir ativo relacionado <ExternalLink size={14} />
                  </button>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
