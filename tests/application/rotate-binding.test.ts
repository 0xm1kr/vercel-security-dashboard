import test from "node:test";
import assert from "node:assert/strict";
import { RotateEnvBindingUseCase } from "../../src/application/rotation/rotate-binding.ts";
import type { Clock } from "../../src/application/ports/clock.ts";
import type { IdGenerator } from "../../src/application/ports/id-generator.ts";
import type { InventoryRepository } from "../../src/application/ports/inventory-repository.ts";
import type { RotationRepository } from "../../src/application/ports/rotation-repository.ts";
import type {
  UpsertEnvValueInput,
  VercelPort,
  VercelTeamSummary,
  VercelUser,
} from "../../src/application/ports/vercel-port.ts";
import type { EnvBinding } from "../../src/domain/inventory/env-binding.ts";
import type { RotationEvent } from "../../src/domain/rotation/rotation-event.ts";
import type { Project } from "../../src/domain/inventory/project.ts";
import type { DiffEvent } from "../../src/domain/inventory/diff-event.ts";
import {
  EnvBindingId,
  EnvKey,
  ProjectId,
  RemoteEnvId,
  ScanId,
  TeamId,
} from "../../src/domain/shared/ids.ts";

class FakeClock implements Clock {
  constructor(private value = 1700000000000) {}
  now(): number {
    return this.value;
  }
}

class FixedIds implements IdGenerator {
  private n = 0;
  next(): string {
    this.n += 1;
    return `id-${this.n}`;
  }
}

const makeBinding = (overrides: Partial<EnvBinding> = {}): EnvBinding => ({
  id: EnvBindingId("binding-1"),
  remoteId: RemoteEnvId("env-1"),
  teamId: TeamId("team-1"),
  projectId: ProjectId("proj-1"),
  key: EnvKey("STRIPE_SECRET_KEY"),
  targets: ["production", "preview"],
  gitBranch: null,
  type: "secret",
  remoteCreatedAt: 0,
  remoteUpdatedAt: 0,
  lastSeenScanId: ScanId("scan-1"),
  rotationStatus: "never",
  rotatedAt: null,
  ...overrides,
});

class FakeInventory implements InventoryRepository {
  public binding: EnvBinding | null = null;
  public lastRotationAt: number | null = null;

  async upsertProjects(): Promise<void> {}
  async listProjects(): Promise<readonly Project[]> {
    return [];
  }
  async getProject(): Promise<Project | null> {
    return null;
  }
  async upsertBindings(): Promise<void> {}
  async listBindings(): Promise<readonly EnvBinding[]> {
    return this.binding === null ? [] : [this.binding];
  }
  async getBinding(): Promise<EnvBinding | null> {
    return this.binding;
  }
  async markStaleAsSuperseded(): Promise<readonly EnvBindingId[]> {
    return [];
  }
  async appendDiffEvents(_events: readonly DiffEvent[]): Promise<void> {}
  async listDiffEvents(): Promise<readonly DiffEvent[]> {
    return [];
  }
  async recordRotation(_id: EnvBindingId, at: number): Promise<void> {
    this.lastRotationAt = at;
  }
}

class FakeRotationRepo implements RotationRepository {
  public events: RotationEvent[] = [];
  async append(event: RotationEvent): Promise<void> {
    this.events.push(event);
  }
  async listForBinding(): Promise<readonly RotationEvent[]> {
    return this.events;
  }
  async listRecent(): Promise<readonly RotationEvent[]> {
    return this.events;
  }
}

class FakeVercel implements VercelPort {
  public lastUpdate: UpsertEnvValueInput | null = null;
  public mode: "ok" | "fail" = "ok";

  async getCurrentUser(): Promise<VercelUser> {
    return { id: "u", username: "u", email: null };
  }
  async listTeams(): Promise<readonly VercelTeamSummary[]> {
    return [];
  }
  async listProjects(): Promise<readonly Project[]> {
    return [];
  }
  async listEnvBindings(): Promise<never[]> {
    return [];
  }
  async updateEnvValue(_token: string, input: UpsertEnvValueInput): Promise<number> {
    this.lastUpdate = input;
    if (this.mode === "fail") throw new Error("upstream blew up");
    return 200;
  }
  async createAuthToken(): Promise<string> {
    return "new-token";
  }
}

test("rotate-binding writes audit, marks rotated, and zeroes the buffer", async () => {
  const inventory = new FakeInventory();
  const binding = makeBinding();
  inventory.binding = binding;
  const rotations = new FakeRotationRepo();
  const vercel = new FakeVercel();
  const useCase = new RotateEnvBindingUseCase(
    vercel,
    inventory,
    rotations,
    new FakeClock(),
    new FixedIds(),
  );

  const buffer = Buffer.from("super-secret-value", "utf8");
  const original = Buffer.from(buffer);
  const result = await useCase.execute({
    token: "tok",
    teamId: TeamId("team-1"),
    bindingId: binding.id,
    newValue: buffer,
    targets: null,
    note: "manual",
    markSensitive: true,
  });

  assert.equal(result.bindingId, binding.id);
  assert.equal(result.status, 200);
  assert.equal(rotations.events.length, 1);
  assert.equal(rotations.events[0]?.success, true);
  assert.equal(rotations.events[0]?.note, "manual");
  assert.notEqual(inventory.lastRotationAt, null);
  // Buffer must have been zeroed.
  assert.notDeepEqual(buffer, original);
  assert.equal(buffer.every((b) => b === 0), true);
  // Vercel adapter received the value buffer with the upgraded type.
  assert.notEqual(vercel.lastUpdate, null);
  assert.equal(vercel.lastUpdate?.type, "sensitive");
});

test("rotate-binding upgrades a plain binding to sensitive when flag is true", async () => {
  const inventory = new FakeInventory();
  inventory.binding = makeBinding({ type: "plain" });
  const rotations = new FakeRotationRepo();
  const vercel = new FakeVercel();
  const useCase = new RotateEnvBindingUseCase(
    vercel,
    inventory,
    rotations,
    new FakeClock(),
    new FixedIds(),
  );
  await useCase.execute({
    token: "tok",
    teamId: TeamId("team-1"),
    bindingId: inventory.binding!.id,
    newValue: Buffer.from("v"),
    targets: null,
    note: null,
    markSensitive: true,
  });
  assert.equal(vercel.lastUpdate?.type, "sensitive");
});

test("rotate-binding preserves the existing type when markSensitive is false", async () => {
  const inventory = new FakeInventory();
  inventory.binding = makeBinding({ type: "encrypted" });
  const rotations = new FakeRotationRepo();
  const vercel = new FakeVercel();
  const useCase = new RotateEnvBindingUseCase(
    vercel,
    inventory,
    rotations,
    new FakeClock(),
    new FixedIds(),
  );
  await useCase.execute({
    token: "tok",
    teamId: TeamId("team-1"),
    bindingId: inventory.binding!.id,
    newValue: Buffer.from("v"),
    targets: null,
    note: null,
    markSensitive: false,
  });
  assert.equal(vercel.lastUpdate?.type, "encrypted");
});

test("rotate-binding never tries to mark system bindings sensitive", async () => {
  const inventory = new FakeInventory();
  inventory.binding = makeBinding({ type: "system" });
  const rotations = new FakeRotationRepo();
  const vercel = new FakeVercel();
  const useCase = new RotateEnvBindingUseCase(
    vercel,
    inventory,
    rotations,
    new FakeClock(),
    new FixedIds(),
  );
  await useCase.execute({
    token: "tok",
    teamId: TeamId("team-1"),
    bindingId: inventory.binding!.id,
    newValue: Buffer.from("v"),
    targets: null,
    note: null,
    markSensitive: true,
  });
  assert.equal(vercel.lastUpdate?.type, "system");
});

test("rotate-binding records failure audit and rethrows when upstream fails", async () => {
  const inventory = new FakeInventory();
  inventory.binding = makeBinding();
  const rotations = new FakeRotationRepo();
  const vercel = new FakeVercel();
  vercel.mode = "fail";
  const useCase = new RotateEnvBindingUseCase(
    vercel,
    inventory,
    rotations,
    new FakeClock(),
    new FixedIds(),
  );

  const buffer = Buffer.from("v", "utf8");
  await assert.rejects(() =>
    useCase.execute({
      token: "tok",
      teamId: TeamId("team-1"),
      bindingId: inventory.binding!.id,
      newValue: buffer,
      targets: null,
      note: null,
      markSensitive: true,
    }),
  );
  assert.equal(rotations.events.length, 1);
  assert.equal(rotations.events[0]?.success, false);
  assert.equal(inventory.lastRotationAt, null);
  assert.equal(buffer.every((b) => b === 0), true);
});

test("rotate-binding rejects superseded bindings", async () => {
  const inventory = new FakeInventory();
  inventory.binding = makeBinding({ rotationStatus: "superseded" });
  const rotations = new FakeRotationRepo();
  const useCase = new RotateEnvBindingUseCase(
    new FakeVercel(),
    inventory,
    rotations,
    new FakeClock(),
    new FixedIds(),
  );
  const buffer = Buffer.from("v", "utf8");
  await assert.rejects(() =>
    useCase.execute({
      token: "tok",
      teamId: TeamId("team-1"),
      bindingId: inventory.binding!.id,
      newValue: buffer,
      targets: null,
      note: null,
      markSensitive: true,
    }),
  );
  assert.equal(rotations.events.length, 0);
  assert.equal(buffer.every((b) => b === 0), true);
});
