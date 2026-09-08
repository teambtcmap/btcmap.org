// Shared by the signup form (instant feedback via native minlength/maxlength)
// the API enforces its own rules; this is the client-side guidance.
// The login route keeps the same upper bound for its own inputs.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 200;
