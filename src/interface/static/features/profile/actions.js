import { api } from "../../core/api.js";
import { navigate } from "../../core/hash.js";
import { refreshProfile } from "./state.js";

export const lockSession = async () => {
  await api("POST", "/api/session/lock");
  await refreshProfile();
  navigate("#/unlock");
};
