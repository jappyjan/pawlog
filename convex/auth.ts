import { setupConvexAuth } from "@convex-dev/auth/server";
import { setupUsernamePassword } from "@convex-dev/auth/methods/username-password/server";
import { components, internal } from "./_generated/api";

const auth = setupConvexAuth({
  component: components.auth,
  sessionMaxLifetimeSeconds: 60 * 60 * 24 * 180, // stay signed in ~6 months
  refreshInactivityTimeoutSeconds: 60 * 60 * 24 * 60,
});

export const { signOut, refreshSession, isAuthenticated } = auth;

export const { signUpWithUsernamePassword, signInWithUsernamePassword, changePassword } =
  setupUsernamePassword(auth, {
    component: components.authPassword,
    usernameComponent: components.authUsername,
  }).attachUserCallbacks({
    createUser: internal.users.createUser,
    onSignIn: internal.users.onSignIn,
  });
