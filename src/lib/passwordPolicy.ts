// Client-side password bounds for the auth forms' native
// minlength/maxlength feedback. The API enforces its own rules — these
// exist purely so the user hears about a too-short password before the
// request leaves the browser.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 200;
