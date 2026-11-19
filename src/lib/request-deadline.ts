export async function deadlineFetch(
  input: string | URL | Request,
  init: RequestInit = {},
): Promise<Response> {
  const timeout = AbortSignal.timeout(20000);
  return fetch(input, {
    ...init,
    signal: init.signal ? AbortSignal.any([init.signal, timeout]) : timeout,
  });
}
