import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("atlas, tutorial, setup, progress and coverage have no automated WCAG A/AA violations", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "Telencéfalo." }),
  ).toBeVisible();
  for (const destination of [
    "atlas",
    "Como usar o NeuroGame",
    "Treinar",
    "Meu progresso",
    "Cobertura do roteiro",
  ]) {
    if (destination !== "atlas")
      await page
        .getByRole("button", { name: destination, exact: true })
        .click();
    if (destination === "Como usar o NeuroGame")
      await expect(page.locator(".modal-backdrop")).toHaveCSS("opacity", "1");
    if (destination === "Meu progresso")
      await expect(page.locator(".progress-page")).toBeVisible();
    if (destination === "Cobertura do roteiro")
      await expect(
        page.locator(".coverage-table details").first(),
      ).toBeVisible();
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      result.violations.length,
      `${destination}: ${JSON.stringify(result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })) })))}`,
    ).toBe(0);
    if (destination === "Como usar o NeuroGame") {
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: destination }),
      ).toBeFocused();
    }
  }
});
