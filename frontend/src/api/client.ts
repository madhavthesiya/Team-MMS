import type {
  ClassCreated,
  ClassInfo,
  JoinResult,
  OverrideIn,
  Quiz,
  QuizIn,
  ResponseDetail,
  ResponseIn,
  Results,
  StudentInfo,
  SubmitResult,
} from "./types";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

type Auth = { teacher?: string; student?: string };

function messageFrom(status: number, body: unknown): string {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail[0]?.msg) return `Please check your input: ${detail[0].msg}`;
  }
  if (status === 404) return "Resource not found.";
  if (status === 403) return "You do not have permission to access this resource.";
  if (status === 409) return "This action conflicts with the current state.";
  if (status === 429) return "Too many requests — please wait a moment and try again.";
  if (status >= 500) return "The server had an unexpected issue. Please try again.";
  return `Request failed with status ${status}.`;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  auth: Auth = {},
  timeoutMs = 30000
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth.teacher) headers["X-Teacher-Token"] = auth.teacher;
  if (auth.student) headers["X-Student-Token"] = auth.student;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const apiBase = ((import.meta.env.VITE_API_URL as string) || "").replace(/\/+$/, "") + "/api";
  let res: Response;
  try {
    res = await fetch(`${apiBase}${path}`, {
      method,
      headers,
      signal: controller.signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError(408, "The request timed out. Please try again.");
    }
    throw new ApiError(0, "Can't reach the server. Please check your connection.");
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, messageFrom(res.status, data));
  }
  return data as T;
}

export const api = {
  createClass: (name: string) => request<ClassCreated>("POST", "/classes", { name }),
  createSampleClass: () => request<ClassCreated>("POST", "/classes/sample"),
  getClass: (id: number, token: string) =>
    request<ClassInfo>("GET", `/classes/${id}`, undefined, { teacher: token }),
  saveQuiz: (id: number, token: string, quiz: QuizIn) =>
    request<Quiz>("PUT", `/classes/${id}/quiz`, quiz, { teacher: token }),
  deleteClass: (id: number, token: string) =>
    request<void>("DELETE", `/classes/${id}`, undefined, { teacher: token }),
  getResults: (id: number, token: string) =>
    request<Results>("GET", `/classes/${id}/results`, undefined, { teacher: token }),
  getResponse: (rid: number, token: string) =>
    request<ResponseDetail>("GET", `/responses/${rid}`, undefined, { teacher: token }),
  overrideResponse: (rid: number, token: string, body: OverrideIn) =>
    request<ResponseDetail>("POST", `/responses/${rid}/override`, body, { teacher: token }),
  join: (join_code: string, nickname: string) =>
    request<JoinResult>("POST", "/join", { join_code, nickname }),
  me: (token: string) =>
    request<StudentInfo>("GET", "/students/me", undefined, { student: token }),
  submit: (token: string, body: ResponseIn) =>
    request<SubmitResult>("POST", "/responses", body, { student: token }, 45000),
  reply: (token: string, followUpId: number, reply: string) =>
    request<{ status: "done" }>(
      "POST",
      `/follow-ups/${followUpId}/reply`,
      { reply },
      { student: token },
      45000
    ),
  resumeFollowUp: (token: string, followUpId: number) =>
    request<{ status: "done" }>(
      "POST",
      `/follow-ups/${followUpId}/resume`,
      undefined,
      { student: token },
      45000
    ),
};
