export async function readSessionToken(store) {
  try {
    const token = await store.getItemAsync("session_token");
    return token === null
      ? { kind: "missing" }
      : { kind: "value", token };
  } catch {
    return { kind: "unavailable" };
  }
}
