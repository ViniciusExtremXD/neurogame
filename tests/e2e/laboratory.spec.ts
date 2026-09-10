import { test, expect, type Page } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
const manifest = JSON.parse(
  readFileSync("public/anatomy/manifest.json", "utf8"),
);
const catalog = JSON.parse(readFileSync("public/content/catalog.json", "utf8"));
const evidence = resolve("docs/evidence");
mkdirSync(evidence, { recursive: true });

async function ready(page: Page) {
  await expect(page.locator(".model-stage")).toHaveAttribute(
    "data-ready",
    "true",
    { timeout: 60000 },
  );
}
async function chooseSliceTraining(
  page: Page,
  kind: "Localizar" | "Nomear" | "Múltipla escolha",
  count = "2",
) {
  await page.getByRole("button", { name: "Treinar", exact: true }).click();
  await page.getByRole("button", { name: new RegExp(`^${kind}`) }).click();
  await page.getByLabel("Visualização do treino").selectOption("slices");
  await page.getByLabel("Número de questões").fill(count);
  await page.getByRole("button", { name: "Começar treino" }).click();
  await expect(page.locator(".slice-viewer")).toHaveAttribute(
    "aria-busy",
    "false",
  );
}
async function savedSession(page: Page) {
  return page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("neurogame:progress:v1")!).activeSession,
  );
}
async function clickCorrectPixel(page: Page) {
  const session = await savedSession(page);
  const q = session.questions[session.cursor];
  const asset = manifest.assets.find(
    (a: { id: string }) => a.id === q.targetId,
  );
  const [x, y] = asset.bestSlices[q.view].pixel;
  const box = await page.locator(".slice-viewer canvas").boundingBox();
  if (!box) throw Error("Missing canvas");
  await page.mouse.click(
    box.x + ((x + 0.5) / 256) * box.width,
    box.y + ((y + 0.5) / 256) * box.height,
  );
}

test("real meshes render and a physical raycast changes selection; drag never selects", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const models: string[] = [];
  page.on("response", (r) => {
    if (r.url().endsWith(".glb") && r.ok()) models.push(r.url());
  });
  await page.goto("./");
  await ready(page);
  expect(models.length).toBeGreaterThan(20);
  const first = await page.locator(".structure-card h2").innerText();
  const box = await page.locator(".brain-canvas canvas").boundingBox();
  expect(box).toBeTruthy();
  let selected = false;
  for (const [x, y] of [
    [0.45, 0.6],
    [0.6, 0.55],
    [0.5, 0.7],
    [0.35, 0.5],
  ]) {
    await page.mouse.click(box!.x + box!.width * x, box!.y + box!.height * y);
    if ((await page.locator(".structure-card h2").innerText()) !== first) {
      selected = true;
      break;
    }
  }
  expect(selected, "physical mesh click must select a real new structure").toBe(
    true,
  );
  const beforeDrag = await page.locator(".structure-card h2").innerText();
  await page.mouse.move(box!.x + box!.width * 0.5, box!.y + box!.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(
    box!.x + box!.width * 0.65,
    box!.y + box!.height * 0.55,
    { steps: 8 },
  );
  await page.mouse.up();
  expect(await page.locator(".structure-card h2").innerText()).toBe(beforeDrag);
  await page
    .getByRole("button", { name: "Restaurar vista", exact: true })
    .click();
  await ready(page);
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    (document.activeElement as HTMLElement)?.blur();
  });
  await page.screenshot({
    path: resolve(evidence, "desktop-atlas.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("fixed aqueduct landmark selects label19 in the aligned axial slice", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("tab", { name: "Cortes de RM", exact: true }).click();
  const slider = page.getByLabel(/Posição do corte/);
  await slider.fill("147");
  await expect(page.locator(".slice-viewer")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  const box = await page.locator(".slice-viewer canvas").boundingBox();
  if (!box) throw Error("Missing slice");
  // Independent reference: source label IJK[149,147,128] -> RAS[0,-21,-19].
  await page.mouse.click(
    box.x + (128.5 / 256) * box.width,
    box.y + (149.5 / 256) * box.height,
  );
  await expect(page.locator(".structure-card h2")).toContainText("Aqueduto");
  await page.screenshot({
    path: resolve(evidence, "aqueduct-slice.png"),
    fullPage: true,
  });
});

test("locate records one answer per physical click, provides feedback and review", async ({
  page,
}) => {
  await page.goto("./");
  await chooseSliceTraining(page, "Localizar", "1");
  await clickCorrectPixel(page);
  await expect(page.locator(".answer-feedback")).toContainText("Correto");
  const s = await savedSession(page);
  expect(s.questions[0].attempts).toHaveLength(1);
  await page.getByRole("button", { name: "Ver resultado" }).click();
  await expect(
    page.getByRole("heading", { name: "Sessão concluída." }),
  ).toBeVisible();
  await expect(page.locator(".score-hero strong")).toHaveText("100%");
});

test("free recall accepts curated normalized names and rejects unrelated names", async ({
  page,
}) => {
  await page.goto("./");
  await chooseSliceTraining(page, "Nomear", "1");
  const s = await savedSession(page);
  const a = catalog.assets.find(
    (a: { id: string }) => a.id === s.questions[0].targetId,
  );
  await expect(page.locator(".structure-card")).toHaveCount(0);
  await expect(page.locator(".sidebar")).toHaveCount(0);
  await page.getByLabel("Sua resposta").fill("estrutura inexistente");
  await page.getByRole("button", { name: "Confirmar resposta" }).click();
  await expect(page.locator(".answer-feedback")).toContainText(
    "Vamos observar",
  );
  await page
    .getByRole("button", { name: "Tentar novamente", exact: true })
    .click();
  await page.getByLabel("Sua resposta").fill(
    a.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase(),
  );
  await page.getByRole("button", { name: "Confirmar resposta" }).click();
  await expect(page.locator(".answer-feedback")).toContainText(
    "Acerto após repetição",
  );
  await page.getByRole("button", { name: "Ver resultado" }).click();
  await expect(page.locator(".score-hero strong")).toHaveText("0%");
});

test("four unique alternatives work and the active exam survives reload without feedback leaks", async ({
  page,
}) => {
  await page.goto("./");
  await chooseSliceTraining(page, "Múltipla escolha", "1");
  const labels = await page.locator(".answer-options button").allTextContents();
  expect(labels).toHaveLength(4);
  expect(new Set(labels).size).toBe(4);
  await page.locator(".answer-options button").first().click();
  await expect(page.locator(".answer-feedback")).toBeVisible();
  await page.getByRole("button", { name: "Simulado", exact: true }).click();
  await page.getByLabel("Visualização do treino").selectOption("slices");
  await page.getByLabel("Número de questões").fill("3");
  await page.getByRole("button", { name: "Iniciar simulado" }).click();
  await expect(page.locator(".slice-viewer")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  const before = await savedSession(page);
  await page.reload();
  await expect(page.locator(".study-workspace")).toBeVisible();
  const after = await savedSession(page);
  expect(after.questions).toEqual(before.questions);
  expect(after.seed).toBe(before.seed);
  await expect(page.locator(".answer-feedback")).toHaveCount(0);
  await expect(page.locator(".sidebar")).toHaveCount(0);
  const q = after.questions[0];
  if (q.kind === "locate") await clickCorrectPixel(page);
  else if (q.kind === "name") {
    await page.getByLabel("Sua resposta").fill("nome errado");
    await page.getByRole("button", { name: "Confirmar resposta" }).click();
  } else await page.locator(".answer-options button").first().click();
  await expect(page.locator(".answer-panel")).toContainText(
    "correção estará disponível no final",
  );
  await expect(page.locator(".answer-feedback")).toHaveCount(0);
  await page.getByRole("button", { name: "Encerrar sessão" }).click();
  await page.getByRole("button", { name: "Encerrar e ver resultado" }).click();
  await expect(
    page.getByRole("heading", { name: "Sessão concluída." }),
  ).toBeVisible();
  await page.screenshot({
    path: resolve(evidence, "exam-review.png"),
    fullPage: true,
  });
});

test("mobile atlas, source coverage, and reduced motion remain usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./");
  await ready(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(page.getByLabel("Reduzir movimento")).toBeChecked();
  await page.getByRole("button", { name: "Abrir módulos" }).click();
  await page.getByLabel("Buscar estrutura", { exact: true }).fill("aqueduto");
  await page
    .getByRole("button", { name: "Aqueduto do mesencéfalo", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Encontrar no corte", exact: true })
    .click();
  await expect(page.locator(".slice-viewer")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await ready(page);
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    (document.activeElement as HTMLElement)?.blur();
  });
  await page.screenshot({
    path: resolve(evidence, "mobile-atlas.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Cobertura do roteiro", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "O roteiro, por inteiro." }),
  ).toBeVisible();
  await page.getByLabel("Buscar no roteiro").fill("medula");
  await expect(page.locator(".coverage-table details").first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("model failure keeps useful 2D fallback and broken slice never accepts an answer", async ({
  page,
}) => {
  await page.route("**/*.glb", (r) => r.abort("failed"));
  await page.goto("./");
  await expect(
    page.getByRole("button", { name: "Abrir atlas de RM" }),
  ).toBeVisible({ timeout: 60000 });
  await page.getByRole("button", { name: "Abrir atlas de RM" }).click();
  await expect(page.locator(".slice-viewer")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await page.getByRole("button", { name: "Treinar", exact: true }).click();
  await page.getByRole("button", { name: /^Nomear/ }).click();
  await page.getByLabel("Visualização do treino").selectOption("slices");
  await page.getByLabel("Número de questões").fill("1");
  await page.route("**/*-labels.png", (r) => r.abort("failed"));
  await page.getByRole("button", { name: "Começar treino" }).click();
  await expect(page.locator(".answer-panel")).toContainText("anulada", {
    timeout: 30000,
  });
  expect((await savedSession(page)).questions[0].attempts).toHaveLength(0);
});

test("missing WebGL offers usable real MRI instead of an empty canvas", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      type: string,
      ...args: unknown[]
    ) {
      if (
        type === "webgl" ||
        type === "webgl2" ||
        type === "experimental-webgl"
      )
        return null;
      return original.apply(this, [type, ...args] as Parameters<
        typeof original
      >);
    } as typeof original;
  });
  await page.goto("./");
  await page.getByRole("button", { name: "Abrir atlas de RM" }).click();
  await expect(page.locator(".slice-viewer")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(page.locator(".slice-viewer canvas")).toBeVisible();
});

test("a transient model connection reset recovers before offering the MRI fallback", async ({ page }) => {
  let requests = 0;
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/models/spl-1024.glb", route => {
    requests++;
    return requests === 1 ? route.abort("connectionreset") : route.continue();
  });
  await page.goto("./");
  await ready(page);
  expect(requests).toBe(2);
  await expect(page.getByRole("button", { name: "Abrir atlas de RM" })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("right lateral and medial views load; hide and isolate can always recover", async ({
  page,
}) => {
  await page.goto("./");
  await ready(page);
  await page.getByRole("button", { name: "Isolar", exact: true }).click();
  await ready(page);
  await page.getByRole("button", { name: "Ocultar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Nenhuma estrutura visível" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Exibir estruturas" }).click();
  await ready(page);
  await page.getByLabel("Hemisfério", { exact: true }).selectOption("right");
  await ready(page);
  await expect(page.getByLabel("Vista anatômica")).toContainText(
    "Lateral direita",
  );
  await page.getByLabel("Vista anatômica").selectOption("medial");
  await ready(page);
  await expect(page.getByLabel("Vista anatômica")).toContainText(
    "Medial direita",
  );
  await expect(page.locator(".loading-caption")).toHaveCount(0);
});
