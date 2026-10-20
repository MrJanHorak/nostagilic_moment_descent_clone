// Long-form authoring regressions exercise the optional full tool layout.
// Default canvas-first behavior is covered separately by the workbench tests.
export async function openAuthoringPanels(page) {
  for (const name of ['Build tools', 'Scene browser']) {
    const button = page.getByRole('button', { name, exact: true });
    if (await button.getAttribute('aria-pressed') === 'false') await button.click();
  }
}
