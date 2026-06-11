// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { contentDisposition } from "./assets.js";

describe("contentDisposition", () => {
  it("preserves a normal filename", () => {
    expect(contentDisposition("logo.png")).toBe(
      `inline; filename="logo.png"; filename*=UTF-8''logo.png`,
    );
  });

  it("strips CR/LF so a header cannot be injected", () => {
    const header = contentDisposition('a.png"\r\nSet-Cookie: x=1');
    // No raw CR/LF survives into the header value.
    expect(header).not.toMatch(/[\r\n]/);
    // The quote that would break the quoted-string is gone too.
    expect(header).toContain(`filename="a.pngSet-Cookie: x=1"`);
  });

  it("drops quotes and backslashes from the legacy token", () => {
    expect(contentDisposition('a"b\\c.pdf')).toContain(`filename="abc.pdf"`);
  });

  it("round-trips non-ASCII via filename*", () => {
    const header = contentDisposition("résumé.pdf");
    expect(header).toContain("filename*=UTF-8''r%C3%A9sum%C3%A9.pdf");
    // Non-ASCII chars are dropped from the legacy ASCII token.
    expect(header).toContain(`filename="rsum.pdf"`);
  });

  it("falls back to 'download' when nothing printable remains", () => {
    expect(contentDisposition("\r\n\t")).toContain(`filename="download"`);
  });
});
