import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const key = "neurogame:progress:v1";
async function createProgress(page: Page) {
  await page.goto("./#treinar");
  await page.getByLabel("Visualização do treino").selectOption("slices");
  await page.getByLabel("Número de questões").fill("1");
  await page.getByRole("button", { name: "Começar treino" }).click();
  await expect(page.locator(".slice-viewer")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await page.getByRole("button", { name: "Meu progresso" }).click();
  await expect(page.locator(".progress-page")).toBeVisible();
  return page.evaluate((key) => localStorage.getItem(key)!, key);
}

test("export, erase, import and invalid import preserve valid history", async ({
  page,
}) => {
  const original = await createProgress(page);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar progresso" }).click();
  const download = await downloadPromise;
  const exported = readFileSync((await download.path())!, "utf8");
  expect(JSON.parse(exported)).toEqual(JSON.parse(original));
  await page
    .getByRole("button", { name: "Apagar progresso", exact: true })
    .click();
  await page.getByRole("button", { name: "Apagar histórico local" }).click();
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).activeSession,
      key,
    ),
  ).toBeNull();
  await page
    .getByLabel("Importar progresso")
    .setInputFiles({
      name: "progresso.json",
      mimeType: "application/json",
      buffer: Buffer.from(exported),
    });
  await expect(page.getByRole("status")).toHaveText(
    "Progresso importado com sucesso.",
  );
  expect(
    JSON.parse((await page.evaluate((key) => localStorage.getItem(key), key))!),
  ).toEqual(JSON.parse(original));
  await page
    .getByLabel("Importar progresso")
    .setInputFiles({
      name: "invalido.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"version":99}'),
    });
  await expect(page.getByRole("status")).not.toHaveText(
    "Progresso importado com sucesso.",
  );
  expect(
    JSON.parse((await page.evaluate((key) => localStorage.getItem(key), key))!),
  ).toEqual(JSON.parse(original));
});

test("a delayed import cannot restore erased progress or overwrite a newer session", async ({
  page,
}) => {
  const original = await createProgress(page);
  await page.evaluate(() => {
    const originalText = File.prototype.text;
    File.prototype.text = async function () {
      await new Promise<void>((resolve) => {
        (window as unknown as { releaseImport: () => void }).releaseImport =
          resolve;
      });
      return originalText.call(this);
    };
  });
  await page
    .getByLabel("Importar progresso")
    .setInputFiles({
      name: "progresso.json",
      mimeType: "application/json",
      buffer: Buffer.from(original),
    });
  await expect(page.getByLabel("Importar progresso")).toBeDisabled();
  await expect(page.getByLabel("Importar progresso")).toHaveValue("");
  await page
    .getByRole("button", { name: "Apagar progresso", exact: true })
    .click();
  await page.getByRole("button", { name: "Apagar histórico local" }).click();
  await page.evaluate(() => {
    (window as unknown as { releaseImport: () => void }).releaseImport();
  });
  await expect(page.getByRole("status")).toHaveText(
    "Histórico apagado neste navegador.",
  );
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).activeSession,
      key,
    ),
  ).toBeNull();
  await page
    .getByLabel("Importar progresso")
    .setInputFiles({
      name: "progresso.json",
      mimeType: "application/json",
      buffer: Buffer.from(original),
    });
  await expect(page.getByLabel("Importar progresso")).toBeDisabled();
  await page.getByRole("button", { name: "Treinar", exact: true }).click();
  await page.getByLabel("Visualização do treino").selectOption("slices");
  await page.getByLabel("Número de questões").fill("2");
  await page.getByRole("button", { name: "Começar treino" }).click();
  await expect(page.locator(".slice-viewer")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  const newId = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).activeSession.id,
    key,
  );
  await page.evaluate(() => {
    (window as unknown as { releaseImport: () => void }).releaseImport();
  });
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).activeSession.id,
      key,
    ),
  ).toBe(newId);
});

test("browser history pauses study and skip link preserves the active route", async ({
  page,
}) => {
  await page.goto("./#explorar");
  await page.getByRole("button", { name: "Treinar", exact: true }).click();
  await page.getByLabel("Visualização do treino").selectOption("slices");
  await page.getByLabel("Número de questões").fill("1");
  await page.getByRole("button", { name: "Começar treino" }).click();
  await expect(page.locator(".slice-viewer")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await page.locator(".skip-link").focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#treinar$/);
  await expect(page.locator("#main-content")).toBeFocused();
  await page.goBack();
  await expect(page).toHaveURL(/#explorar$/);
  await expect
    .poll(() =>
      page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)!).activeSession.pausedAt,
        key,
      ),
    )
    .not.toBeNull();
});
