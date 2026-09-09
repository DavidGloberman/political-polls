import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "image-export-bridge",
      transformIndexHtml(html) {
        return html.replace(
          "</body>",
          '    <script type="module" src="/src/exportBridge.ts"></script>\n  </body>',
        );
      },
    },
  ],
});
