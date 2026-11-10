import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider } from "@clerk/react";
import App from "./App";
import { startGlider } from "./helpers/glider";
import "./index.css";

startGlider();

const key = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!key) throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={key} afterSignOutUrl="/">
      <App />
    </ClerkProvider>
  </React.StrictMode>,
);
