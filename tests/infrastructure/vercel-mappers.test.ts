import test from "node:test";
import assert from "node:assert/strict";
import {
  mapVercelEnvBindings,
  mapVercelProjectsPage,
  mapVercelTeams,
  mapVercelUser,
} from "../../src/infrastructure/vercel/mappers.ts";

test("mapVercelUser supports both flat and nested user shapes", () => {
  assert.equal(mapVercelUser({ id: "u1", username: "alice" }).username, "alice");
  assert.equal(
    mapVercelUser({ user: { uid: "u2", username: "bob", email: "b@x" } }).email,
    "b@x",
  );
});

test("mapVercelTeams skips teams without ids", () => {
  const teams = mapVercelTeams({
    teams: [
      { id: "t1", name: "Team One", slug: "team-one" },
      { name: "broken" },
    ],
  });
  assert.equal(teams.length, 1);
  assert.equal(teams[0]?.id, "t1");
});

test("mapVercelProjectsPage extracts pagination cursor", () => {
  const page = mapVercelProjectsPage(
    {
      projects: [{ id: "p1", name: "site", framework: "nextjs", updatedAt: 1 }],
      pagination: { next: 12345 },
    },
    "team-1",
  );
  assert.equal(page.projects[0]?.name, "site");
  assert.equal(page.nextUntil, "12345");
});

test("mapVercelEnvBindings normalizes types and targets", () => {
  const env = mapVercelEnvBindings({
    envs: [
      {
        id: "env-1",
        key: "STRIPE_SECRET_KEY",
        type: "encrypted",
        target: ["preview", "production", "development", "staging"],
      },
      {
        id: "env-2",
        key: "WEIRD",
        type: "totally-new",
        target: "not-array",
      },
    ],
  });
  assert.equal(env.length, 2);
  assert.deepEqual(env[0]?.targets, ["production", "preview", "development"]);
  assert.equal(env[0]?.type, "encrypted");
  assert.equal(env[1]?.type, "other");
  assert.deepEqual(env[1]?.targets, []);
});
