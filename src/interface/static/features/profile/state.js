import { api } from "../../core/api.js";

/**
 * Global "are we onboarded / unlocked?" state. Polled at startup and
 * after any auth-affecting action (unlock, lock, save onboarding,
 * reset).
 */
export const profileState = {
  /** Connection profile (org name etc.) once onboarding is complete. */
  profile: null,
  /** Whether an encrypted token exists on disk. */
  hasToken: false,
  /** Active session metadata, or null when locked. */
  session: null,
};

export const refreshProfile = async () => {
  const result = await api("GET", "/api/profile");
  profileState.hasToken = result.hasToken;
  profileState.profile = result.profile;
  profileState.session = result.session;
};

export const isOnboarded = () =>
  profileState.hasToken === true && profileState.profile !== null;

export const isUnlocked = () => profileState.session !== null;
