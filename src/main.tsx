import React from "react";
import ReactDOM from "react-dom/client";
import { createTheme, MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/notifications/styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1
    }
  }
});

const theme = createTheme({
  fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  headings: {
    fontFamily: "'Inter', system-ui, sans-serif",
    fontWeight: "800",
  },
  primaryColor: "indigo",
  defaultRadius: "md",

  colors: {
    indigo: [
      "#eef2ff", "#e0e7ff", "#c7d2fe", "#a5b4fc",
      "#818cf8", "#6366f1", "#4f46e5", "#4338ca",
      "#3730a3", "#312e81",
    ],
  },

  components: {
    AppShell: {
      styles: {
        main: {
          background: "#f1f5f9",
        },
      },
    },
    Button: {
      defaultProps: { radius: "md" },
      styles: {
        root: {
          fontWeight: 600,
          transition: "all 0.15s cubic-bezier(0.4,0,0.2,1)",
        },
      },
    },
    Card: {
      defaultProps: { radius: "xl", withBorder: false },
      styles: {
        root: {
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          boxShadow: "0 2px 8px rgba(15,23,42,0.08)",
        },
      },
    },
    Paper: {
      defaultProps: { radius: "xl" },
      styles: {
        root: {
          background: "#ffffff",
        },
      },
    },
    Badge: {
      defaultProps: { radius: "sm" },
      styles: {
        root: { fontWeight: 700 },
      },
    },
    TextInput: {
      defaultProps: { radius: "md" },
    },
    NumberInput: {
      defaultProps: { radius: "md" },
    },
    Select: {
      defaultProps: { radius: "md" },
    },
    Autocomplete: {
      defaultProps: { radius: "md" },
    },
    Textarea: {
      defaultProps: { radius: "md" },
    },
    Modal: {
      defaultProps: { radius: "xl", centered: true },
      styles: {
        content: {
          borderRadius: 20,
          boxShadow: "0 24px 64px rgba(15,23,42,0.22)",
        },
        header: {
          borderBottom: "1px solid #e2e8f0",
          paddingBottom: 16,
          fontWeight: 800,
        },
      },
    },
    Drawer: {
      styles: {
        content: {
          background: "#ffffff",
        },
      },
    },
    Notification: {
      styles: {
        root: {
          borderRadius: 14,
          boxShadow: "0 8px 24px rgba(15,23,42,0.14)",
          border: "1px solid #e2e8f0",
        },
      },
    },
    Progress: {
      defaultProps: { radius: "xl" },
    },
    Tooltip: {
      defaultProps: { radius: "md" },
      styles: {
        tooltip: {
          fontSize: 12,
          fontWeight: 600,
          padding: "5px 10px",
        },
      },
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <MantineProvider defaultColorScheme="light" theme={theme}>
        <App />
      </MantineProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
