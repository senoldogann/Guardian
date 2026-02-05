import { describe, expect, it } from "vitest";
import { buildGraphFromPaths } from "../DiagramView";

const getNode = (nodes: { id: string; data: { type: string; count?: number } }[], id: string) =>
  nodes.find((n) => n.id === id);

describe("DiagramView graph builder", () => {
  it("adds child counts for folder nodes", () => {
    const { nodes } = buildGraphFromPaths([
      "src/main.ts",
      "src/utils/helpers.ts",
      "README.md",
    ]);

    const srcNode = getNode(nodes as any, "src");
    const utilsNode = getNode(nodes as any, "src/utils");

    expect(srcNode?.data.type).toBe("folder");
    expect(srcNode?.data.count).toBe(2);

    expect(utilsNode?.data.type).toBe("folder");
    expect(utilsNode?.data.count).toBe(1);
  });
});
