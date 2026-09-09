import { downloadTableAsPng } from "./exportImage";
import { loadTable } from "./storage";
import { allValid } from "./utils";

function connectExportButton() {
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>("button.primary")).find(
    (element) => element.textContent?.includes("צור תמונה"),
  );

  if (!button || button.dataset.exportConnected === "true") {
    return;
  }

  button.dataset.exportConnected = "true";
  button.addEventListener("click", async () => {
    const table = loadTable();

    if (!table || !allValid(table)) {
      return;
    }

    button.disabled = true;

    try {
      await downloadTableAsPng(table);
    } catch (error) {
      console.error("Failed to export table as PNG", error);
    } finally {
      button.disabled = false;
    }
  });
}

const observer = new MutationObserver(connectExportButton);
observer.observe(document.body, { childList: true, subtree: true });
connectExportButton();
