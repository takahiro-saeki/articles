export function readTicketStatuses(value: unknown): Array<"ok" | "error"> {
  if (
    typeof value !== "object" || value === null ||
    !("data" in value) || !Array.isArray(value.data)
  ) {
    throw new Error("Expected a data array");
  }
  return value.data.map((ticket: unknown) => {
    if (
      typeof ticket !== "object" || ticket === null ||
      !("status" in ticket)
    ) {
      throw new Error("Expected a ticket object");
    }
    const status = ticket.status;
    if (status !== "ok" && status !== "error") {
      throw new Error("Unexpected ticket status");
    }
    return status;
  });
}
