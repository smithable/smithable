import assert from "node:assert/strict";

/** Embedded contact forms keep the submit row after every field, even below the viewport. */
export async function checkContactForm(page) {
  const form = page.locator('[data-section="contact"] [data-kit="model-form"] form');
  if (!(await form.count())) return;
  const bounds = await form.evaluate((form) => {
    const fields = form.querySelector("fieldset").getBoundingClientRect();
    const actions = form.querySelector('[data-part="actions"]');
    return {
      end: fields.bottom,
      actions: actions.getBoundingClientRect().top,
      position: getComputedStyle(actions).position,
    };
  });
  assert.notEqual(bounds.position, "sticky", "an embedded contact form has a sticky submit row");
  assert.ok(bounds.actions >= bounds.end, "the contact submit row covers its fields");
}
