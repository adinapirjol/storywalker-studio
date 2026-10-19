import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createVaultSession, deleteAllVaultSessions, VAULT_SESSION_COOKIE } from "@/lib/vault/vault-session";
const storage = vi.hoisted(() => ({ work: vi.fn(), read: vi.fn(), configure: vi.fn() }));
vi.mock("@/lib/vault/vault-route-access", () => ({ withBrowserVault: storage.work }));
vi.mock("./server/research-journal", () => ({ researchView: storage.read, configureResearch: storage.configure }));
import { GET, POST } from "@/app/api/health-research/route";
let token: string;
beforeEach(() => { vi.clearAllMocks(); token = createVaultSession(Buffer.alloc(32, 22)).token; storage.work.mockImplementation(async (_token, callback) => callback({})); storage.read.mockReturnValue({ journal:null }); storage.configure.mockReturnValue({ journal:null }); });
afterEach(() => { deleteAllVaultSessions(); });
function req(body?: unknown, origin = "http://localhost:3000", authenticated = true) {
  return new NextRequest("http://localhost:3000/api/health-research", { method: body === undefined ? "GET" : "POST", headers: { origin, ...(authenticated ? { cookie:`${VAULT_SESSION_COOKIE}=${token}` } : {}) }, ...(body === undefined ? {} : { body:JSON.stringify(body) }) });
}
it("denies foreign origins and locked reads/writes before opening private storage",async()=>{
  expect((await GET(req(undefined,"https://foreign.example"))).status).toBe(403);
  expect((await POST(req({action:"connect"},"https://foreign.example"))).status).toBe(403);
  expect((await GET(req(undefined,undefined,false))).status).toBe(401);
  expect((await POST(req({action:"connect"},undefined,false))).status).toBe(401);
  expect(storage.work).not.toHaveBeenCalled();
});
it("accepts commands only, never raw health payloads, and returns no cached responses",async()=>{
  expect((await POST(req({action:"connect", observations:["PRIVATE_CANARY"]}))).status).toBe(422);
  expect((await POST(req({action:"connect",source:"x".repeat(2000)}))).status).toBe(422);
  expect(storage.work).not.toHaveBeenCalled();
  const response=await POST(req({action:"connect"}));
  expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toBe("no-store");
  expect(storage.configure).toHaveBeenCalledWith({},"connect",undefined);
});
it("does not expose storage exception content",async()=>{
  storage.work.mockRejectedValue(Error("PRIVATE_CANARY"));
  const response=await GET(req());expect(await response.text()).not.toContain("PRIVATE_CANARY");
});

it("bounds hypothesis commands and rejects mixing them with other actions",async()=>{
  expect((await POST(req({action:"refresh",hypothesis:"fictional"}))).status).toBe(422);
  expect((await POST(req({action:"set-hypothesis",hypothesis:"x".repeat(1201)}))).status).toBe(422);
  expect((await POST(req({action:"set-hypothesis"}))).status).toBe(422);
  const response=await POST(req({action:"set-hypothesis",hypothesis:"Fictional contextual hypothesis"}));
  expect(response.status).toBe(200);
  expect(storage.configure).toHaveBeenCalledWith({},"set-hypothesis",undefined,"Fictional contextual hypothesis");
});

it("validates cycle context at the authenticated local boundary", async () => {
  const cycleContext = { date: "2026-02-01", day: 9, included: false };
  for (const patch of [{day:0}, {day:367}, {day:1.5}, {date:"2026-02-30"}, {included:"yes"}, {phase:"invented"}, {expectedLength:0}]) {
    expect((await POST(req({ action:"set-cycle-context", cycleContext:{...cycleContext,...patch} }))).status).toBe(422);
  }
  expect((await POST(req({action:"refresh",cycleContext}))).status).toBe(422);
  expect((await POST(req({action:"set-cycle-context",cycleContext},undefined,false))).status).toBe(401);
  expect((await POST(req({action:"set-cycle-context",cycleContext},"https://foreign.example"))).status).toBe(403);
  expect(storage.work).not.toHaveBeenCalled();
  expect((await POST(req({action:"set-cycle-context",cycleContext}))).status).toBe(200);
  expect(storage.configure).toHaveBeenCalledWith({},"set-cycle-context",undefined,undefined,cycleContext);
  expect((await POST(req({action:"set-cycle-context",cycleContext:null}))).status).toBe(200);
});
