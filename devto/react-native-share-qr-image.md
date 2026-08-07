---
devto_id: 4336316
canonical_url: https://qiita.com/hiro123/items/3dd9bb25393a1bf704f6
title: Converting Invite QR Codes to PNG and Sharing in React Native
tags: React Native, Expo, QR Code, TypeScript
published: true
---

This article is an English translation of the original Japanese article.

I made it possible to display the app invite link as a QR code and share it directly as an image.

For displaying the QR code I use `react-native-qrcode-svg`, for converting the View to PNG I use `react-native-view-shot`, and for the share sheet I use `expo-sharing`.

```bash
npx expo install expo-sharing react-native-view-shot
pnpm add react-native-qrcode-svg react-native-svg
```

## Including the Organization Name in the Image, Not Just the QR Code

To ensure the content is clear from the shared image alone, I include both the QR code and the organization name in a single View.

```tsx
const captureAreaRef = useRef<View>(null);

<View
  ref={captureAreaRef}
  collapsable={false}
  style={styles.captureArea}
>
  <Text style={styles.orgName}>{orgName}</Text>
  <QRCode
    value={inviteUrl}
    size={200}
    color={colors.foreground}
    backgroundColor={colors.card}
  />
</View>
```

I add `collapsable={false}` to prevent React Native from omitting the native View through optimization, which would make the `captureRef` target unavailable.

I also specify the background color. If I share a transparent image and the recipient's background is dark, the QR code margins and organization name can become hard to read.

## Saving the View as PNG

For the share button, I pass the View's ref to `captureRef`.

```ts
const captured = await captureRef(captureAreaRef, {
  format: "png",
  quality: 1,
});
```

The returned value is the path to a temporary file. On Android, paths without a scheme can be returned, so I prepend `file://` before sharing.

```ts
const uri = captured.startsWith("file://")
  ? captured
  : `file://${captured}`;
```

## Sharing with `expo-sharing`

I check if the sharing feature is available on the device before opening the share sheet.

```ts
if (await Sharing.isAvailableAsync()) {
  await Sharing.shareAsync(uri, {
    mimeType: "image/png",
    dialogTitle: `Invite QR code for ${orgName}`,
  });
} else {
  await Share.share({ url: uri });
}
```

In the actual implementation, I also maintain state to prevent multiple share processes from starting on repeated taps.

```ts
const [sharing, setSharing] = useState(false);

const handleShareImage = async () => {
  if (sharing) return;
  setSharing(true);

  try {
    // captureRef and shareAsync
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    Alert.alert("Share failed", message);
  } finally {
    setSharing(false);
  }
};
```

While processing, I disable the button and switch the label to "Preparing to share". Because there is a slight delay from capture to the share sheet opening, this prevents it from appearing unresponsive.

## What to Put in the QR Code

The QR code contains an HTTPS invite URL that can also be opened on the web, rather than a custom scheme.

```ts
const inviteUrl = `${config.apiUrl}/invite/${orgId}`;
```

On iOS, Universal Links are configured, so if the app is installed, the invite screen opens in the app. If not, the web version displays.

The QR image is not a screenshot. I limit the capture target to a dedicated View, so the modal close button and the "Share Image" button are not included in the image.

## Full Implementation

Summarizing the key points, it looks like this:

```tsx
export function InviteQrModal({ orgName, inviteUrl }: Props) {
  const captureAreaRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);

  const share = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const path = await captureRef(captureAreaRef, {
        format: "png",
        quality: 1,
      });
      const uri = path.startsWith("file://") ? path : `file://${path}`;
      await Sharing.shareAsync(uri, { mimeType: "image/png" });
    } finally {
      setSharing(false);
    }
  };

  return (
    <>
      <View ref={captureAreaRef} collapsable={false}>
        <Text>{orgName}</Text>
        <QRCode value={inviteUrl} size={200} />
      </View>
      <Pressable onPress={share} disabled={sharing}>
        <Text>{sharing ? "Preparing to share..." : "Share Image"}</Text>
      </Pressable>
    </>
  );
}
```

Rather than converting the QR code SVG directly to a file, capturing the displayed View as is made it easier to create a shared image that includes the organization name and description.

## References

- [Expo Sharing](https://docs.expo.dev/versions/latest/sdk/sharing/)
- [react-native-view-shot](https://github.com/gre/react-native-view-shot)
- [react-native-qrcode-svg](https://github.com/Expensify/react-native-qrcode-svg)
