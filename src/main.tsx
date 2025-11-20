import React from "react";
import ReactDOM from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/notifications/styles.css";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <MantineProvider
        defaultColorScheme="light"
        theme={{
          fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          headings: { fontWeight: "700" },
          defaultRadius: "lg"
        }}
      >
        <App />
      </MantineProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
