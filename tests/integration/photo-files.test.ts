import { describe, expect, it } from "vitest";
import { writePhotoFiles } from "@/server/photos";

describe("photo file rollback", () => {
  it("removes files already written when a later write fails", async () => {
    const removed: string[] = [];
    const written: string[] = [];
    await expect(
      writePhotoFiles(
        [
          { absolutePath: "a.jpg", bytes: Uint8Array.from([1]) },
          { absolutePath: "b.jpg", bytes: Uint8Array.from([2]) },
        ],
        {
          writeFile: async (filePath) => {
            if (filePath === "b.jpg") throw new Error("disk full");
            written.push(filePath);
          },
          remove: async (filePath) => {
            removed.push(filePath);
          },
        },
      ),
    ).rejects.toThrow("disk full");
    expect(written).toEqual(["a.jpg"]);
    expect(removed).toEqual(["a.jpg"]);
  });
});
