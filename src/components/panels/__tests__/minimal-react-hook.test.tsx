// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";

describe("React hook with createRoot + act", () => {
  it("renders a component with useState", async () => {
    function TestComp() {
      const [val] = useState("works");
      return <div>{val}</div>;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);

    await act(async () => {
      createRoot(container).render(<TestComp />);
    });

    expect(container.textContent).toBe("works");
    document.body.removeChild(container);
  });
});
