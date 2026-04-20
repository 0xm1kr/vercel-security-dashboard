import { mkdirSync } from "node:fs";
import { GetDashboardDataUseCase } from "./application/inventory/get-dashboard-data.js";
import { ListTeamsUseCase } from "./application/onboarding/list-teams.js";
import { MintScopedTokenUseCase } from "./application/onboarding/mint-scoped-token.js";
import { RotateEnvBindingUseCase } from "./application/rotation/rotate-binding.js";
import { RunScanUseCase } from "./application/inventory/run-scan.js";
import { SaveOnboardingUseCase } from "./application/onboarding/save-onboarding.js";
import { VerifyCredentialsUseCase } from "./application/onboarding/verify-credentials.js";
import { FileCredentialStore } from "./infrastructure/credentials/file-credential-store.js";
import { FileVendorRuleSource } from "./infrastructure/classification/file-vendor-rule-source.js";
import { openDatabase } from "./infrastructure/persistence/database.js";
import { SqliteInventoryRepository } from "./infrastructure/persistence/sqlite-inventory-repository.js";
import { SqliteRotationRepository } from "./infrastructure/persistence/sqlite-rotation-repository.js";
import { SqliteScanRepository } from "./infrastructure/persistence/sqlite-scan-repository.js";
import { SystemClock } from "./infrastructure/system/system-clock.js";
import { UuidGenerator } from "./infrastructure/system/uuid-generator.js";
import { VercelRestAdapter } from "./infrastructure/vercel/vercel-rest-adapter.js";
import { SessionStore } from "./interface/http/session.js";
import { LoginThrottle } from "./interface/http/throttle.js";
import type { AppContext } from "./interface/http/handlers/types.js";
import type { AppConfig } from "./config.js";

export interface AssembledApp {
  readonly ctx: AppContext;
  close(): void;
}

export const assembleApp = (config: AppConfig): AssembledApp => {
  mkdirSync(config.dataDir, { recursive: true });

  const db = openDatabase(config.databasePath);
  const clock = new SystemClock();
  const ids = new UuidGenerator();
  const vercel = new VercelRestAdapter();

  const inventoryRepo = new SqliteInventoryRepository(db);
  const scanRepo = new SqliteScanRepository(db);
  const rotationRepo = new SqliteRotationRepository(db);

  const credentialStore = new FileCredentialStore(config.dataDir);
  const ruleSource = new FileVendorRuleSource(
    config.vendorRulesDefault,
    config.vendorRulesOverride,
    config.vendorRulesSuggestions,
  );

  const sessions = new SessionStore();
  const unlockThrottle = new LoginThrottle();

  const ctx: AppContext = {
    credentials: credentialStore,
    sessions,
    unlockThrottle,
    verifyCredentials: new VerifyCredentialsUseCase(vercel),
    listTeams: new ListTeamsUseCase(vercel),
    saveOnboarding: new SaveOnboardingUseCase(credentialStore, vercel, clock),
    mintScopedToken: new MintScopedTokenUseCase(vercel, credentialStore),
    runScan: new RunScanUseCase(
      vercel,
      inventoryRepo,
      scanRepo,
      ruleSource,
      clock,
      ids,
    ),
    getDashboardData: new GetDashboardDataUseCase(inventoryRepo, scanRepo, ruleSource),
    rotateBinding: new RotateEnvBindingUseCase(
      vercel,
      inventoryRepo,
      rotationRepo,
      clock,
      ids,
    ),
  };

  return {
    ctx,
    close: () => {
      db.close();
    },
  };
};
