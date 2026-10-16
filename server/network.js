export function privateIPv4(address) {
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(address)) return false;
  const parts = address.split(".").map(Number);
  if (
    parts.length !== 4 ||
    parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)
  )
    return false;
  return (
    parts[0] === 10 ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
  );
}

export function lanAddresses(interfaces, port) {
  // Prefer physical Wi-Fi/Ethernet interfaces over VPN and virtual adapters.
  const priority = (name) => (/^(en\d|wlan|wl|eth)/.test(name) ? 0 : 1);
  const entries = Object.entries(interfaces).sort(
    ([a], [b]) => priority(a) - priority(b),
  );
  return [
    ...new Set(
      entries
        .flatMap(([, values]) => values ?? [])
        .filter(
          (x) => x.family === "IPv4" && !x.internal && privateIPv4(x.address),
        )
        .map((x) => `http://${x.address}:${port}`),
    ),
  ];
}

export function roomConnection({ host, configuredMode, playMode, addresses }) {
  const url = new URL(`http://${host}`);
  const loopback =
    url.hostname === "localhost" ||
    url.hostname === "[::1]" ||
    /^127\./.test(url.hostname);
  const local = privateIPv4(url.hostname);
  if (
    configuredMode !== "lan" &&
    !(playMode === "same-wifi" && (local || loopback))
  ) {
    return { mode: "internet", inviteOrigin: null };
  }
  const inviteOrigin = local ? url.origin : addresses[0];
  if (!inviteOrigin)
    throw Error(
      "No local Wi-Fi address is available. Connect this computer to Wi-Fi and try again.",
    );
  return { mode: "lan", inviteOrigin };
}
