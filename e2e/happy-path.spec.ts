import { test, expect } from "@playwright/test";

test("sign up → create card → move card across columns", async ({ page }) => {
  const unique = Date.now();
  const email = `pw-${unique}@example.com`;
  const password = "playwright-pass-1";
  const cardTitle = `Buy milk ${unique}`;

  // ---- Sign up ----
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Playwright");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /create account/i }).click();

  await expect(page).toHaveURL(/\/board$/);

  // The three default columns should be present.
  const todo = page.locator('[data-testid="kanban-column"][data-column-name="To Do"]');
  const inProgress = page.locator('[data-testid="kanban-column"][data-column-name="In Progress"]');
  const done = page.locator('[data-testid="kanban-column"][data-column-name="Done"]');
  await expect(todo).toBeVisible();
  await expect(inProgress).toBeVisible();
  await expect(done).toBeVisible();

  // ---- Create a card in "To Do" ----
  await todo.getByRole("button", { name: /add card/i }).click();
  await todo.getByPlaceholder("Card title").fill(cardTitle);
  await todo.getByRole("button", { name: /^add$/i }).click();
  await expect(todo.getByText(cardTitle)).toBeVisible();
  await expect(inProgress.getByText(cardTitle)).toHaveCount(0);

  // ---- Drag the card from "To Do" into "In Progress" ----
  // dnd-kit's MouseSensor activates after 6px of movement, so we walk the mouse
  // by hand rather than relying on a single dragTo() call.
  const handle = todo.locator(`text=${cardTitle}`).locator("..").locator("..").getByRole("button", { name: "Drag card" });
  await handle.scrollIntoViewIfNeeded();
  const handleBox = await handle.boundingBox();
  const targetBox = await inProgress.boundingBox();
  if (!handleBox || !targetBox) throw new Error("Could not measure drag elements");

  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  // Small initial movement to satisfy MouseSensor activation distance.
  await page.mouse.move(handleBox.x + 30, handleBox.y + 5, { steps: 5 });
  // Walk into the destination column.
  await page.mouse.move(
    targetBox.x + targetBox.width / 2,
    targetBox.y + targetBox.height / 2,
    { steps: 20 },
  );
  await page.mouse.up();

  // ---- Verify the card moved ----
  await expect(inProgress.getByText(cardTitle)).toBeVisible({ timeout: 5_000 });
  await expect(todo.getByText(cardTitle)).toHaveCount(0);
});
