const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";

export interface ApiErrorResponse {
  statusCode: number;
  error?: string;
  message: string | string[];
  requestId?: string;
  timestamp?: string;
}

export class ApiError extends Error {
  statusCode: number;
  errorType?: string;
  messages: string[];

  constructor(statusCode: number, message: string | string[], errorType?: string) {
    const messageStr = Array.isArray(message) ? message.join(". ") : message;
    super(messageStr);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.errorType = errorType;
    this.messages = Array.isArray(message) ? message : [message];
  }
}

function getStoredAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("surcos_access_token");
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const token = getStoredAccessToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errorData = data as ApiErrorResponse;
      throw new ApiError(
        res.status,
        errorData.message || res.statusText || "Ocurrió un error inesperado",
        errorData.error
      );
    }

    return data as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    // Network or fetch abort error
    throw new ApiError(
      0,
      "No se pudo conectar con el servidor. Verifica que el backend esté ejecutándose en http://localhost:3000.",
      "NetworkError"
    );
  }
}
