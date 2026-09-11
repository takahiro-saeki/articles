---
title: "unknown does not validate an API response: comparing any, assertions, and runtime checks"
published: false
tags: typescript, api, testing
canonical_url: null
---

Receiving an external API response as unknown lets the compiler stop property access that has not been checked. The type itself does not validate the shape of JSON at runtime.

This comparison uses a push sender from a personal project to test any, unknown, and type assertions. Comparing compiler results with runtime logs also found malformed responses that the code silently skipped.

## Change only the type for the same JSON

In the following value, data is not an array.

```ts
const raw = '{"data":{"unexpected":true}}';
const value: any = JSON.parse(raw);
console.log(value.data[0].status.toUpperCase());
```

Verification used macOS 26.6.2, Node.js 24.15.0, and TypeScript 7.0.2. Compiler settings were strict, target ES2022, and noEmit. The runtime comparison removed types only.

| How the value is received | Compilation | Runtime |
| --- | --- | --- |
| Annotate value as any | Passes | TypeError |
| Annotate value as unknown and use the same access | Stops with TS18046 | Not run as successfully compiled code |
| Assert a type whose data field is an array | Passes | TypeError |

As the [TypeScript documentation for unknown](https://www.typescriptlang.org/docs/handbook/2/functions.html#unknown) describes, specific property operations are unavailable while a value remains unknown. The [type assertion documentation](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#type-assertions) explains that assertions add no runtime check and are removed during compilation.

Using as to get past the line rejected for unknown does not validate the response. The malformed JSON shape stayed unchanged in this comparison.

## Actual code did not always throw on malformed responses

The [push sender](https://github.com/takahiro-saeki/circle-hub/blob/a34608c611ded6549c1176a7977e68e1bc62a8db/apps/web/src/server/api/lib/expo-push.ts) at circle-hub commit `a34608c` asserts `await res.json()` as ExpoSendResponse. It checks HTTP failures and ticket errors, but that assertion does not inspect the structure.

The retrieved function ran unchanged, with local substitutes for fetch, the database, and logging. These are the results of 6 cases that changed the response. No request went to the actual API.

| Response | Logging calls | Invalid tokens deleted | Function's Promise |
| --- | ---: | ---: | --- |
| Valid ok ticket | 0 | 0 | fulfilled |
| Error ticket with DeviceNotRegistered | 1 | 1 | fulfilled |
| data is an object | 0 | 0 | fulfilled |
| status is a number | 0 | 0 | fulfilled |
| Entire response is null | 1 | 0 | fulfilled |
| HTTP 503 | 1 | 0 | fulfilled |

When data is an object, the length used by the code is undefined, and the ticket-processing loop does not run. A numeric status also fails to match error and is skipped. With null, property access throws and the catch block logs the failure.

A fulfilled Promise therefore does not establish that the response had the expected shape. The deletion count also belongs to the substitute database; no real token was deleted.

## Inspect the part you need, starting from unknown

The same repository's [guest response storage code](https://github.com/takahiro-saeki/circle-hub/blob/a34608c611ded6549c1176a7977e68e1bc62a8db/apps/mobile/src/lib/guest-response-store.ts) receives JSON.parse output as unknown and checks the array and row fields. Although that code handles stored data, the sequence of receiving a boundary value and checking its required shape also applies to API responses.

The following function was written for this comparison. It reads only ticket statuses and has not been applied to the original push sender.

```ts
function readTicketStatuses(value: unknown): Array<"ok" | "error"> {
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
```

unknown requires checks before use; the if statements perform those checks. The function returns only the statuses it inspected. It does not relabel the entire original object as validated.

Across 6 inputs, it accepted a valid ticket array and an empty array. It rejected the other 4 with exceptions: an object in data, a numeric status, a null ticket, and a null response.

## What this function leaves unchecked

This is not a validator for the complete Expo response. It does not inspect ticket IDs, details, message, request-level errors, or correspondence with the number of submitted messages. Code using those fields needs additional checks and branches for error responses.

Accepting an empty array also means that requiring the result count to match the submitted count is a separate condition. After narrowing the type, check the counts and relationships required by the operation.

The caller must also decide whether a failed response check should trigger a retry or stop processing with an observable result. This experiment examined malformed response handling; it did not change the original sender's return value or retry policy.
