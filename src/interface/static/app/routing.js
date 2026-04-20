import { currentHash } from "../core/hash.js";
import { DashboardView } from "../features/dashboard/view.js";
import { OnboardingView } from "../features/onboarding/view.js";
import { isOnboarded, isUnlocked } from "../features/profile/state.js";
import { UnlockView } from "../features/unlock/view.js";

/**
 * Decide which top-level view to render.
 *
 * Auth gates take precedence over the URL hash:
 *   - no token / no profile → onboarding wizard
 *   - locked              → unlock screen
 *   - otherwise            → dashboard (or onboarding when explicitly requested)
 */
export const resolveView = () => {
  if (!isOnboarded()) return OnboardingView;
  if (!isUnlocked()) return UnlockView;
  if (currentHash() === "#/onboarding") return OnboardingView;
  return DashboardView;
};
