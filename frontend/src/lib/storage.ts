import type { User } from "../api/types";

// In-memory fallback for private browsing or storage-restricted environments
const memory = new Map<string, string>();

function read(key: string): string | null {
  try {
    const value = localStorage.getItem(key);
    if (value !== null) return value;
  } catch {
    /* fallback to memory */
  }
  return memory.get(key) ?? null;
}

function write(key: string, value: string | null): void {
  if (value === null) {
    memory.delete(key);
  } else {
    memory.set(key, value);
  }

  try {
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  } catch {
    /* memory still holds the state for the current session */
  }
}

export const storage = {
  teacherToken: (classId: number): string | null => read(`btm.teacher.${classId}`),
  setTeacherToken: (classId: number, token: string | null): void =>
    write(`btm.teacher.${classId}`, token),
  studentToken: (): string | null => read("btm.student"),
  setStudentToken: (token: string | null): void => write("btm.student", token),

  // Real User & Teacher Account session storage
  authToken: (): string | null => read("btm.auth.token"),
  setAuthToken: (token: string | null): void => write("btm.auth.token", token),
  authUser: (): User | null => {
    const raw = read("btm.auth.user");
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  },
  setAuthUser: (user: User | null): void => {
    write("btm.auth.user", user ? JSON.stringify(user) : null);
  },
  clearAuth: (): void => {
    write("btm.auth.token", null);
    write("btm.auth.user", null);
  },
};
