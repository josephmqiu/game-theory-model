import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { ErrorBoundary } from "@/components/shell/error-boundary";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Game Theory Analyzer",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  shellComponent: RootDocument,
});

function NotFoundComponent() {
  return (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      <p>Page not found</p>
    </div>
  );
}

function RootComponent() {
  return (
    <ErrorBoundary>
      <Outlet />
    </ErrorBoundary>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
