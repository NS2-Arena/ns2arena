import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "app/App";
import { Providers } from "app/Providers";
import "app/main.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Providers>
      <main>
        <App />
      </main>
    </Providers>
  </StrictMode>
);
