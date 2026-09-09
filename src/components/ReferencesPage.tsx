import { ExternalLink, FileCheck2, HeartHandshake } from "lucide-react";
import type { Catalog } from "../content/catalog";
export default function ReferencesPage({ catalog }: { catalog: Catalog }) {
  return (
    <div className="references-page">
      <span className="eyebrow">CONHECIMENTO COM ORIGEM</span>
      <h1>Referências, dados e cuidado.</h1>
      <p className="page-intro">
        Um laboratório educacional beta para estudantes de Medicina. Cada
        representação tem uma origem; cada lacuna permanece visível.
      </p>
      <div className="reference-cards">
        <section className="setup-panel">
          <FileCheck2 size={25} />
          <h2>Roteiro da disciplina</h2>
          <p>
            <strong>
              Roteiro de aulas práticas de Neuroanatomia — Medicina.
            </strong>{" "}
            Leonardo Augusto Lombardi, UFTM. 10 páginas.
          </p>
          <p>
            Organiza os {catalog.curriculumCount} itens contextuais deste
            catálogo. O arquivo é referência privada e não integra o site.
          </p>
        </section>
        <section className="setup-panel">
          <BookIcon />
          <h2>Referência acadêmica</h2>
          <p>
            <strong>Atlas de Neuroanatomia Humana.</strong> Gabriel Henrique
            Lombardi e Leonardo Augusto Lombardi, 2024. 137 páginas do PDF.
          </p>
          <p>
            As fichas distinguem a página do PDF da página impressa. Figuras e
            páginas não foram redistribuídas.
          </p>
        </section>
        <section className="setup-panel">
          <HeartHandshake size={25} />
          <h2>Atlas SPL/NAC</h2>
          <p>
            Malhas, volume T1 e segmentação da mesma edição do atlas, preparados
            para este laboratório. Preservamos unidades, orientação e
            lateralidade.
          </p>
          <p>
            Licença Slicer, partes B e C; versões convertidas e modificadas
            identificadas nos avisos. Revisão anatômica humana pendente.
          </p>
          <a
            href="https://www.openanatomy.org/atlas-pages/atlas-spl-nac-brain.html"
            target="_blank"
            rel="noreferrer"
          >
            Open Anatomy Project <ExternalLink size={14} />
          </a>
        </section>
      </div>
      <section className="reference-detail">
        <h2>Como a correspondência funciona</h2>
        <p>
          Os modelos usam coordenadas RAS em milímetros. A RM é reamostrada na
          grade nativa dos rótulos, considerando o deslocamento de 0,5 mm
          presente nos cabeçalhos. A cor visível é apenas uma legenda: a
          identificação usa o ID inteiro de cada região.
        </p>
        <p>
          Quando a fonte apresenta divergências, o ativo pode ser explorado, mas
          não é incluído no banco de questões. Mapas ausentes não são
          substituídos por geometria inventada. A cobertura integral da
          disciplina ainda depende de complementos e revisão.
        </p>
        <div className="reference-links">
          <a
            href={
              import.meta.env.BASE_URL + "anatomy/licenses/SLICER-LICENSE.txt"
            }
            target="_blank"
            rel="noreferrer"
          >
            Licença Slicer completa <ExternalLink size={14} />
          </a>
          <a
            href={import.meta.env.BASE_URL + "anatomy/THIRD_PARTY_NOTICES.md"}
            target="_blank"
            rel="noreferrer"
          >
            Licenças e atribuições <ExternalLink size={14} />
          </a>
          <a
            href={`https://github.com/mhalle/spl-brain-atlas/tree/${catalog.sourceCommit}`}
            target="_blank"
            rel="noreferrer"
          >
            Versão exata dos dados <ExternalLink size={14} />
          </a>
          <a
            href="https://nba.uth.tmc.edu/NEUROANATOMY/"
            target="_blank"
            rel="noreferrer"
          >
            Neuroanatomy Online · UTHealth Houston <ExternalLink size={14} />
          </a>
          <a
            href="https://github.com/ViniciusExtremXD/neurogame"
            target="_blank"
            rel="noreferrer"
          >
            Código e fila de revisão <ExternalLink size={14} />
          </a>
        </div>
      </section>
      <p className="muted">
        Ferramenta de estudo. Não destinada a diagnóstico ou decisões clínicas.
        Não há endosso institucional ou aprovação acadêmica implícita.
      </p>
    </div>
  );
}
function BookIcon() {
  return <FileCheck2 size={25} />;
}
