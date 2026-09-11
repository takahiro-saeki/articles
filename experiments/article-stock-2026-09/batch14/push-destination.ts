export type PushDestination =
  | { provider: "expo"; token: string }
  | { provider: "fcm"; token: string }
  | { provider: "apns"; token: string };

export function makeExpoPayload(
  destination: Extract<PushDestination, { provider: "expo" }>,
) {
  return { to: destination.token, title: "Routing example" };
}
