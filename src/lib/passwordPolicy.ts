// Shared by the signup form (instant feedback via native minlength/maxlength)
// and the /api/session/signup route, where the policy is actually enforced.
// The login route keeps the same upper bound for its own inputs.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 200;
