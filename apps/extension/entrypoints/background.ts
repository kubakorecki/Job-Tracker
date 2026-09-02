export default defineBackground(() => {
  // Clicking the toolbar icon opens the side panel directly (no popup).
  browser.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error: unknown) => console.error(error));
});
