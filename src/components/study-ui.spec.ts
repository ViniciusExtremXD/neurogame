import { test, expect } from "@playwright/test";
import { createServer, type ViteDevServer } from "vite";

let server: ViteDevServer;
const url = "http://127.0.0.1:5274/neurogame/";
test.use({ channel: process.env.PLAYWRIGHT_CHANNEL });

test.beforeAll(async () => {
  server = await createServer({
    server: { port: 5274, host: "127.0.0.1", strictPort: true },
  });
  await server.listen();
});
test.afterAll(async () => {
  await server?.close();
});

test("starting from setup creates a session that can be restored without changing the answer order", async ({
  page,
}) => {
  await page.goto(url + "#treinar");
  await page.getByLabel("Visualização do treino").selectOption("slices");
  await page.getByLabel("Número de questões").fill("2");
  await page.getByRole("button", { name: "Começar treino" }).click();
  await expect(page.locator(".study-workspace")).toBeVisible();
  const restored = await page.evaluate(async () => {
    const storagePath = "/neurogame/src/domain/storage.ts";
    const catalogPath = "/neurogame/src/content/catalog.ts";
    const { importProgress, STORAGE_KEY } = await import(storagePath);
    const { targetsFromCatalog } = await import(catalogPath);
    const catalog = await (
      await fetch("/neurogame/content/catalog.json")
    ).json();
    return importProgress(
      localStorage.getItem(STORAGE_KEY),
      targetsFromCatalog(catalog),
    );
  });
  expect(restored.ok).toBe(true);
  await page.reload();
  await expect(page.locator(".study-workspace")).toBeVisible();
  await expect(
    page.getByText("O progresso contém uma sessão ou questão inválida.", {
      exact: true,
    }),
  ).toHaveCount(0);
});

test("download failures are shown as a status without an uncaught exception", async ({
  page,
}) => {
  const uncaught: string[] = [];
  page.on("pageerror", (error) => uncaught.push(error.message));
  await page.goto(url + "#progresso");
  await page.evaluate(() => {
    URL.createObjectURL = () => {
      throw new Error("Test download unavailable");
    };
  });
  await page.getByRole("button", { name: "Exportar progresso" }).click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: /exportar|exportação|download/i }),
  ).toBeVisible();
  expect(uncaught).toEqual([]);
});

test("locate in a slice lets keyboard users inspect numbered regions without exposing names", async ({
  page,
}) => {
  await page.goto(url + "#treinar");
  await page.getByLabel("Visualização do treino").selectOption("slices");
  await page.getByLabel("Número de questões").fill("1");
  await page.getByRole("button", { name: "Começar treino" }).click();
  await expect(page.locator(".slice-viewer")).toHaveAttribute(
    "aria-busy",
    "false",
    { timeout: 30000 },
  );
  await page.getByText("Selecionar com teclado", { exact: true }).click();
  const button = page.getByRole("button", { name: "Alvo 1", exact: true });
  await expect(button).toBeEnabled();
  const before = await page.locator(".slice-viewer canvas").screenshot();
  await button.focus();
  await expect
    .poll(async () =>
      (await page.locator(".slice-viewer canvas").screenshot()).equals(before),
    )
    .toBe(false);
  await expect(page.locator(".answer-feedback")).toHaveCount(0);
});

test("retry preserves the first error and answering does not reload the displayed slice", async ({
  page,
}) => {
  const sliceRequests: string[] = [];
  page.on("request", (request) => {
    if (/\/slices\/.+\.png/.test(request.url()))
      sliceRequests.push(request.url());
  });
  await page.goto(url + "#treinar");
  await page.getByRole("button", { name: /Nomear Observe/ }).click();
  await page.getByLabel("Visualização do treino").selectOption("slices");
  await page.getByLabel("Número de questões").fill("1");
  await page.getByRole("button", { name: "Começar treino" }).click();
  await expect(page.getByLabel("Sua resposta", { exact: true })).toBeEnabled();
  const loadedCount = sliceRequests.length;
  await page
    .getByLabel("Sua resposta", { exact: true })
    .fill("Uma resposta incorreta");
  await page.getByRole("button", { name: "Confirmar resposta" }).click();
  await expect(page.locator(".answer-feedback")).toBeVisible();
  expect(sliceRequests).toHaveLength(loadedCount);
  await page
    .getByRole("button", { name: "Tentar novamente", exact: true })
    .click();
  await expect(page.getByLabel("Sua resposta", { exact: true })).toBeEnabled();
  const name = await page.evaluate(async () => {
    const saved = JSON.parse(localStorage.getItem("neurogame:progress:v1")!);
    const catalog = await (
      await fetch("/neurogame/content/catalog.json")
    ).json();
    return catalog.assets.find(
      (asset: { id: string; name: string }) =>
        asset.id === saved.activeSession.questions[0].targetId,
    ).name;
  });
  await page.getByLabel("Sua resposta", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Confirmar resposta" }).dblclick();
  await expect(page.locator(".answer-feedback")).toContainText(
    "Acerto após repetição.",
  );
  await page
    .getByRole("button", { name: "Ver resultado", exact: true })
    .click();
  await expect(page.locator(".score-hero")).toContainText("0%");
  await expect(page.locator(".result-row")).toContainText(
    "Acerto após repetição",
  );
  const persisted = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("neurogame:progress:v1")!).sessions.at(-1),
  );
  expect(persisted.questions[0].attempts).toHaveLength(2);
  expect(persisted.questions[0].attempts[0].correct).toBe(false);
  expect(persisted.questions[0].retryCount).toBe(1);
});

test("ending early states the number of omissions and allows the student to continue", async ({
  page,
}) => {
  await page.goto(url + "#treinar");
  await page.getByLabel("Visualização do treino").selectOption("slices");
  await page.getByLabel("Número de questões").fill("2");
  await page.getByRole("button", { name: "Começar treino" }).click();
  await expect(
    page.getByRole("button", { name: "Pular esta questão" }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Encerrar sessão", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "2 questões sem resposta",
  );
  await page
    .getByRole("button", { name: "Continuar sessão", exact: true })
    .click();
  await expect(page.locator(".delete-confirm")).toHaveCount(0);
  await page.getByRole("button", { name: "Pular esta questão" }).click();
  await page.getByRole("button", { name: "Próxima questão" }).click();
  await expect(
    page.getByRole("button", { name: "Pular esta questão" }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Encerrar sessão", exact: true })
    .click();
  await page.getByRole("button", { name: "Encerrar e ver resultado" }).click();
  await expect(page.locator(".score-grid")).toContainText("2questões omitidas");
});

test("loading a slice pauses the clock and resumes only after the resource is available", async ({
  page,
}) => {
  let release: () => void = () => {};
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(/\/slices\/.*-labels\.png$/, async (route) => {
    await hold;
    await route.continue();
  });
  await page.goto(url + "#treinar");
  await page.getByLabel("Visualização do treino").selectOption("slices");
  await page.getByLabel("Número de questões").fill("1");
  await page.getByRole("button", { name: "Começar treino" }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("neurogame:progress:v1")!)
            .activeSession.pausedAt,
      ),
    )
    .not.toBeNull();
  await expect(
    page.getByRole("button", { name: "Pular esta questão" }),
  ).toBeDisabled();
  release();
  await expect(
    page.getByRole("button", { name: "Pular esta questão" }),
  ).toBeEnabled();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("neurogame:progress:v1")!)
            .activeSession.pausedAt,
      ),
    )
    .toBeNull();
});

test("a failed slice is annulled and can advance without a wrong answer or omission", async ({
  page,
}) => {
  await page.route(/\/slices\/.*-labels\.png$/, (route) =>
    route.fulfill({ status: 404, body: "Fixture unavailable" }),
  );
  await page.goto(url + "#treinar");
  await page.getByLabel("Visualização do treino").selectOption("slices");
  await page.getByLabel("Número de questões").fill("1");
  await page.getByRole("button", { name: "Começar treino" }).click();
  await expect(page.locator(".answer-feedback")).toContainText(
    "Questão anulada",
  );
  await expect(
    page.getByRole("button", { name: "Ver resultado", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Ver resultado", exact: true })
    .click();
  await expect(page.locator(".score-hero")).toContainText("—");
  await expect(page.locator(".scoring-note")).toContainText("1 anuladas");
  await expect(page.locator(".score-grid")).toContainText("0questões omitidas");
});
