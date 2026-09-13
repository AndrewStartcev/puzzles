import { expect, test } from "@playwright/test";
test("scatters, rotates by click, persists orientation and controls the reference", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Играть", exact: true }).click();
  await page.getByRole("button", { name: "12 деталей", exact: true }).click();
  await page.getByRole("button", { name: "Собирать пазл" }).click();
  await expect(page.locator("canvas")).toBeVisible();
  const opacity = page.getByRole("slider", { name: "Прозрачность подсказки" });
  await opacity.focus();
  await opacity.press("End");
  await expect(opacity).toHaveValue("100");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("local:mir-pazlov:save:v1")!)
            .hintOpacity,
      ),
    )
    .toBe(1);
  await opacity.press("Home");
  await opacity.press("PageUp");
  await page.getByRole("button", { name: "Показать макет" }).click();
  await expect(page.getByRole("dialog", { name: "Макет пазла" })).toBeVisible();
  await page.screenshot({ path: "test-results/reference.png" });
  await page.getByRole("button", { name: "Закрыть макет" }).click();
  await page.getByRole("button", { name: "Раскидать пазлы" }).click();
  await expect(page.locator(".tray-piece")).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(
            localStorage.getItem("local:mir-pazlov:save:v1")!,
          ).pieces.filter((p: { location: string }) => p.location === "board")
            .length,
      ),
    )
    .toBe(12);
  const original = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("local:mir-pazlov:save:v1")!);
    const p = s.pieces[0];
    const h = (((160 * 4) / 3) * s.config.imageHeight) / s.config.imageWidth;
    return {
      rotation: p.rotation,
      x: s.camera.x + (p.x + 80) * s.camera.zoom,
      y: s.camera.y + (p.y + h / 2) * s.camera.zoom,
    };
  });
  const box = (await page.locator("canvas").boundingBox())!;
  await page.mouse.click(box.x + original.x, box.y + original.y);
  const rotation = (original.rotation + 1) % 4;
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("local:mir-pazlov:save:v1")!)
            .pieces[0].rotation,
      ),
    )
    .toBe(rotation);
  await page.screenshot({ path: "test-results/scattered.png" });
  await expect(page.locator(".game-footer")).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: /Продолжить/ }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator(".tray-piece")).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("local:mir-pazlov:save:v1")!)
            .pieces[0].rotation,
      ),
    )
    .toBe(rotation);
});
