import { expect, test } from "@playwright/test";
test("plays, saves, resumes and completes a puzzle", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Соберите свой/ }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/home.png", fullPage: true });
  await page.getByRole("button", { name: "Начать путешествие" }).click();
  await page.getByRole("button", { name: "12 деталей", exact: true }).click();
  await page.getByRole("button", { name: "Собирать пазл" }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByText("Сохранено на устройстве")).toBeVisible();
  const canvas = await page.locator("canvas").boundingBox();
  expect(canvas).toBeTruthy();
  for (let i = 0; i < 12; i++) {
    await page.locator(".tray-scroll").evaluate((el) => {
      el.scrollTop = 0;
    });
    const button = page.locator(".tray-piece").first();
    const id =
      Number(
        (await button.getAttribute("aria-label"))!.replace("Деталь ", ""),
      ) - 1;
    await button.scrollIntoViewIfNeeded();
    const source = (await button.boundingBox())!;
    const target = await page.evaluate((id) => {
      const save = JSON.parse(
        localStorage.getItem("local:mir-pazlov:save:v1")!,
      );
      // The supplied asset is 4:3; use the persisted image aspect for target height.
      const aspect = save.config.imageWidth / save.config.imageHeight;
      const cols = 4,
        rows = 3,
        ch = (160 * cols) / rows / aspect;
      return {
        x: save.camera.x + ((id % cols) * 160 + 80) * save.camera.zoom,
        y:
          save.camera.y +
          (Math.floor(id / cols) * ch + ch / 2) * save.camera.zoom,
      };
    }, id);
    await page.mouse.move(
      source.x + source.width / 2,
      source.y + source.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(canvas!.x + target.x, canvas!.y + target.y, {
      steps: 8,
    });
    await page.mouse.up();
    await expect(page.locator(".game-progress strong")).toHaveText(
      `${i + 1} / 12`,
    );
    if (i === 0) {
      await expect(page.getByText("Сохранено на устройстве")).toBeVisible();
      await page.reload();
      await page.getByRole("button", { name: /Продолжить/ }).click();
      await expect(page.locator(".game-progress strong")).toHaveText("1 / 12");
    }
  }
  await expect(
    page.getByRole("heading", { name: "Картина собрана!" }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/completed.png" });
  expect(errors).toEqual([]);
});
test("opens ~3000 pieces with a virtual tray and camera controls", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Начать путешествие" }).click();
  await page
    .getByRole("button", { name: "~3000 деталей", exact: true })
    .click();
  await page.getByRole("button", { name: "Собирать пазл" }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByText("Сохранено на устройстве")).toBeVisible();
  expect(await page.locator(".tray-piece").count()).toBeLessThan(15);
  await page.getByRole("button", { name: "Весь пазл", exact: true }).click();
  await page.getByRole("button", { name: "Увеличить" }).click();
  await page.getByRole("checkbox", { name: "Только края" }).check();
  await page.screenshot({ path: "test-results/large-puzzle.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("canvas")).toBeVisible();
  await page.screenshot({ path: "test-results/mobile.png" });
  // Stress the actual mesh renderer, not just the generated model / empty board.
  await page.setViewportSize({ width: 1280, height: 800 });
  const fixture = await page.evaluate(() => {
    const key = "local:mir-pazlov:save:v1";
    const save = JSON.parse(localStorage.getItem(key)!);
    const label = document.querySelector(".game-header small")!.textContent!;
    const [cols, rows] = label.match(/\d+/g)!.map(Number);
    const ch =
      (((160 * cols) / rows) * save.config.imageHeight) /
      save.config.imageWidth;
    save.pieces.forEach(
      (p: { id: number; x: number; y: number; location: string }) => {
        p.location = "board";
        p.x = (p.id % cols) * 160;
        p.y = Math.floor(p.id / cols) * ch;
      },
    );
    return JSON.stringify(save);
  });
  const context = page.context();
  await page.close();
  const stress = await context.newPage();
  await stress.addInitScript(
    (value) => localStorage.setItem("local:mir-pazlov:save:v1", value),
    fixture,
  );
  stress.on("pageerror", (error) => errors.push(error.message));
  await stress.goto("/");
  await stress.getByRole("button", { name: /Продолжить/ }).click();
  await expect(stress.locator("canvas")).toBeVisible();
  await expect(stress.getByText("Сохранено на устройстве")).toBeVisible();
  await stress.getByRole("button", { name: "Весь пазл", exact: true }).click();
  await expect(stress.locator(".tray-piece")).toHaveCount(0);
  await stress.screenshot({ path: "test-results/full-table.png" });
  await stress.getByRole("button", { name: "Увеличить" }).click();
  await stress
    .getByRole("button", { name: "← Коллекции", exact: true })
    .click();
  expect(errors).toEqual([]);
});
