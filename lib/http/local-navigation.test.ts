import { expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../../proxy";

function visit(host: string, path = "/research/refusal", method = "GET") {
  return proxy(new NextRequest(`http://localhost:3000${path}`, { method, headers: { host } }));
}
it("redirects local page visits, retaining path, query and the browser's port", () => {
  const response = visit("127.0.0.1:3000", "/vault?returnTo=%2Fresearch%2Fxr");
  expect(response.status).toBe(307);
  expect(response.headers.get("location")).toBe("http://localhost:3000/vault?returnTo=%2Fresearch%2Fxr");
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(visit("[::1]:3001").headers.get("location")).toBe("http://localhost:3001/research/refusal");
  expect(visit("127.0.0.1:3000", "/", "HEAD").status).toBe(307);
});
it("does not loop, redirect other hosts, or replay writes and API traffic", () => {
  for (const host of ["localhost:3000", "storywalker.example", "127.0.0.1.evil.example", "evil.example:3000"]) {
    expect(visit(host).headers.get("location")).toBeNull();
  }
  for (const method of ["POST", "PUT", "DELETE"]) {
    expect(visit("127.0.0.1:3000", "/research/refusal", method).headers.get("location")).toBeNull();
  }
  for (const path of ["/api/vault", "/api/vault/passkeys", "/_next/static/test.js", "/head-tracking-worker.js"]) {
    expect(visit("127.0.0.1:3000", path).headers.get("location")).toBeNull();
  }
});
