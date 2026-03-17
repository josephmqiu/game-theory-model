import { type ReactNode } from "react";
import { act } from "@testing-library/react";
import { createRoot } from "react-dom/client";

export function renderWithShell(ui: ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);

  const root = createRoot(container);

  act(() => {
    root.render(ui);
  });

  return {
    container,
    rerender: (next: ReactNode) => {
      act(() => {
        root.render(next);
      });
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}
