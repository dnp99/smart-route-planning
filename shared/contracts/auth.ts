const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type SignupRequest = {
  displayName: string;
  email: string;
  password: string;
};

export type LoginResponse = {
  token: string;
  user: AuthUser;
};

export type SignupResponse = LoginResponse;

export type MeResponse = {
  user: AuthUser;
};

export const isAuthUser = (value: unknown): value is AuthUser => {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.email === "string" &&
    typeof value.displayName === "string"
  );
};

export const isLoginRequest = (value: unknown): value is LoginRequest => {
  if (!isObject(value)) {
    return false;
  }

  return typeof value.email === "string" && typeof value.password === "string";
};

export const isSignupRequest = (value: unknown): value is SignupRequest => {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.displayName === "string" &&
    typeof value.email === "string" &&
    typeof value.password === "string"
  );
};

export const parseLoginResponse = (value: unknown): LoginResponse | null => {
  if (!isObject(value)) {
    return null;
  }

  if (typeof value.token !== "string" || !isAuthUser(value.user)) {
    return null;
  }

  return {
    token: value.token,
    user: value.user,
  };
};

export const parseMeResponse = (value: unknown): MeResponse | null => {
  if (!isObject(value) || !isAuthUser(value.user)) {
    return null;
  }

  return {
    user: value.user,
  };
};
