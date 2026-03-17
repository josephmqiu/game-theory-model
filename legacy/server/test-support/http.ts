import { getResponseStatus, mockEvent } from "h3";

export interface ApiCallResult<T = unknown> {
  status: number;
  body: T;
}

const DEFAULT_BASE_URL = "http://localhost:3000";

function buildUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  const prefix = path.startsWith("/") ? "" : "/";
  return `${DEFAULT_BASE_URL}${prefix}${path}`;
}

type MockEvent = ReturnType<typeof mockEvent>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHandler = (event: MockEvent) => Promise<any> | any;

async function callHandler<T>(
  handler: AnyHandler,
  request: Request,
): Promise<ApiCallResult<T>> {
  const event = mockEvent(request);
  const body = await handler(event);

  return {
    status: getResponseStatus(event),
    body: body as T,
  };
}

export async function callGet<T>(
  handler: AnyHandler,
  path: string,
): Promise<ApiCallResult<T>> {
  const request = new Request(buildUrl(path), {
    method: "GET",
  });

  return callHandler(handler, request);
}

export async function callPost<T>(
  handler: AnyHandler,
  path: string,
  body?: unknown,
  init?: Omit<RequestInit, "method" | "body">,
): Promise<ApiCallResult<T>> {
  const request = new Request(buildUrl(path), {
    ...(init ?? {}),
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    body: body !== undefined ? JSON.stringify(body) : null,
  });

  return callHandler(handler, request);
}
