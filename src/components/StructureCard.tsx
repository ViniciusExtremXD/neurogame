import {
  BookOpen,
  ChevronRight,
  Crosshair,
  Layers3,
  ExternalLink,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import type { AnatomyAsset } from "../atlas/types";
import { moduleNames } from "../content/catalog";

export default function StructureCard({
  asset,
  onTrain,
  onSlice,
}: {
  asset: AnatomyAsset | undefined;
  onTrain: () => void;
  onSlice: () => void;
}) {
  const [tab, setTab] = useState("overview");
  if (!asset)
    return (
      <aside className="structure-card empty-card">
        <Crosshair size={32} />
        <h2>Conheça cada estrutura</h2>
        <p>
          Selecione uma região no modelo ou use a lista para abrir sua ficha
          anatômica.
        </p>
      </aside>
    );
  return (
    <motion.aside
      className="structure-card"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      key={asset.id}
    >
      <div className="eyebrow">
        <span className="color-dot" style={{ background: asset.color }} />{" "}
        ESTRUTURA SELECIONADA
      </div>
      <h2>{asset.name}</h2>
      <p className="latin-name">{asset.nameEn}</p>
      <div className="tag-row">
        <span className="tag">
          {moduleNames[asset.moduleId] || asset.moduleId}
        </span>
        <span className="tag">
          {asset.hemisphere === "left"
            ? "Esquerda"
            : asset.hemisphere === "right"
              ? "Direita"
              : "Linha mediana"}
        </span>
      </div>
      <div className="card-tabs" role="tablist" aria-label="Ficha anatômica">
        <button
          role="tab"
          aria-selected={tab === "overview"}
          onClick={() => setTab("overview")}
        >
          Visão geral
        </button>
        <button
          role="tab"
          aria-selected={tab === "relations"}
          onClick={() => setTab("relations")}
        >
          Relações
        </button>
      </div>
      <div className="card-copy">
        {asset.technicalReview === "source-discrepancy" && (
          <p className="source-discrepancy">
            {asset.reviewNote ||
              "Ativo com divergência de origem. Uso exploratório; identificação avaliativa e correspondência seccional suspensas até revisão."}
          </p>
        )}
        {tab === "overview" ? (
          <>
            <p className="lead-copy">
              {asset.description?.summary ||
                "Modelo disponível para exploração. A descrição didática e a correspondência curricular desta estrutura aguardam revisão."}
            </p>
            {asset.description?.function && (
              <>
                <h3>O que faz</h3>
                <p>{asset.description.function}</p>
              </>
            )}
            {asset.description?.location && (
              <>
                <h3>Onde encontrar</h3>
                <p>{asset.description.location}</p>
              </>
            )}
          </>
        ) : (
          <>
            <h3>Relações anatômicas</h3>
            <p>
              {asset.description?.relations ||
                "Relações não documentadas nesta versão. Consulte as referências do atlas e a fila de revisão."}
            </p>
            <button
              className="text-button"
              onClick={onSlice}
              disabled={!Object.keys(asset.sliceIndices).length}
            >
              Observar nos cortes <ChevronRight size={15} />
            </button>
          </>
        )}
        {asset.description?.clinical && (
          <>
            <h3>Conexão clínica</h3>
            <p>{asset.description.clinical}</p>
          </>
        )}
        {asset.description?.tip && (
          <div className="study-tip">
            <BookOpen size={18} />
            <div>
              <strong>Conecte para lembrar</strong>
              <p>{asset.description.tip}</p>
            </div>
          </div>
        )}
      </div>
      <div className="card-actions">
        <button
          className="primary"
          onClick={onTrain}
          disabled={!asset.eligible}
        >
          <Crosshair size={17} /> Treinar esta estrutura{" "}
          <ChevronRight size={16} />
        </button>
        {!asset.eligible && (
          <small>Fora das perguntas até validação do mapeamento.</small>
        )}
        <button
          className="secondary"
          onClick={onSlice}
          disabled={!Object.keys(asset.sliceIndices).length}
        >
          <Layers3 size={17} /> Encontrar no corte
        </button>
      </div>
      <details className="references-inline">
        <summary>Fontes e revisão</summary>
        <p>
          Correspondência técnica do atlas. Revisão anatômica humana pendente.
        </p>
        {asset.description?.references.map((r, i) => (
          <p key={i}>
            {r.url ? (
              <a href={r.url} target="_blank" rel="noreferrer">
                {r.title} <ExternalLink size={11} />
              </a>
            ) : (
              r.title
            )}
            {r.pages && ` · ${r.pages}`}
          </p>
        ))}
        <small>
          ID {asset.id} · label {asset.labelId}
        </small>
      </details>
    </motion.aside>
  );
}
