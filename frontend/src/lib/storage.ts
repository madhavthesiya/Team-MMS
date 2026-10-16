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
};
