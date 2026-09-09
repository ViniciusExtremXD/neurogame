import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AnatomyAsset } from "../atlas/types";
import type { Session, StudyTarget } from "../domain/types";
import { createSession, finishSession, submitAnswer } from "../domain/engine";
import StudyWorkspace from "./StudyWorkspace";

const asset: AnatomyAsset = {
  id: "fixture",
  labelId: 9,
  name: "Estrutura confidencial esquerda",
  nameEn: "fixture",
  moduleId: "telencefalo",
  category: "fixture",
  path: "fixture.glb",
  color: "#222222",
  center: [0, 0, 0],
  bounds: [
    [0, 0, 0],
    [1, 1, 1],
  ],
  hemisphere: "left",
  surface: true,
  eligible: true,
  aliases: [],
  curriculumIds: [],
  source: "Fonte da fixture",
  sliceIndices: { axial: 10 },
  description: {
    summary: "Descrição que deve aparecer somente depois da correção.",
    references: [],
  },
};
const target: StudyTarget = {
  id: asset.id,
  name: asset.name,
  aliases: [],
  moduleId: asset.moduleId,
  category: asset.category,
  source: asset.source,
  eligible: true,
  views: ["axial"],
  labelIds: [9],
  sliceIndices: asset.sliceIndices,
};
function render(session: Session) {
  return renderToStaticMarkup(
    createElement(StudyWorkspace, {
      session,
      targets: [target],
      assets: [asset],
      onChange: () => {},
      onExplore: () => {},
      onReview: () => {},
      reducedMotion: true,
    }),
  );
}

describe("exam disclosure boundary", () => {
  it("does not render the answer, description or correction after submission until the exam ends", () => {
    let session = createSession([target], {
      id: "exam",
      seed: "seed",
      mode: "exam",
      count: 1,
      kinds: ["name"],
      startedAt: 1000,
    });
    session = submitAnswer(
      session,
      session.questions[0].id,
      "resposta errada",
      [target],
      1500,
    );
    const markup = render(session);
    expect(markup).toContain(
      "Resposta registrada. A correção estará disponível no final.",
    );
    expect(markup).not.toContain(asset.name);
    expect(markup).not.toContain(asset.description!.summary);
    expect(markup).not.toContain("answer-feedback");
    expect(markup).not.toContain("acertos independentes");
    const finished = render(finishSession(session, 2000));
    expect(finished).toContain(asset.name);
    expect(finished).toContain("acertos independentes");
  });
});
