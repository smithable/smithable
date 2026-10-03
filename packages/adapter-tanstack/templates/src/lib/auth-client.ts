// Smithable app kit: Better Auth in the browser, for signing in and out (also by a code by mail).
import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({ plugins: [emailOTPClient()] });
