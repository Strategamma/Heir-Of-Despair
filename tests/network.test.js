import test from "node:test";
import assert from "node:assert/strict";
import {
  privateIPv4,
  lanAddresses,
  roomConnection,
} from "../server/network.js";

test("only valid private IPv4 addresses are eligible local invites", () => {
  for (const ip of ["10.0.0.5", "172.16.1.2", "172.31.0.8", "192.168.1.20"])
    assert.equal(privateIPv4(ip), true);
  for (const ip of [
    "",
    "localhost",
    "127.0.0.1",
    "8.8.8.8",
    "172.32.1.1",
    "192.168.999.1",
    "1e1.0.0.1",
    "169.254.1.2",
  ])
    assert.equal(privateIPv4(ip), false);
});
test("automatic address selection prefers physical adapters and excludes loopback/public addresses", () => {
  const adapter = (address) => ({ family: "IPv4", internal: false, address });
  const interfaces = {
    utun0: [adapter("10.8.0.1")],
    lo0: [{ ...adapter("127.0.0.1"), internal: true }],
    en0: [adapter("192.168.1.20"), adapter("8.8.8.8")],
  };
  assert.deepEqual(lanAddresses(interfaces, 4178), [
    "http://192.168.1.20:4178",
    "http://10.8.0.1:4178",
  ]);
});
test("Same Wi-Fi from localhost selects the detected address without user input", () => {
  assert.deepEqual(
    roomConnection({
      host: "localhost:4178",
      configuredMode: "internet",
      playMode: "same-wifi",
      addresses: ["http://192.168.1.20:4178"],
    }),
    { mode: "lan", inviteOrigin: "http://192.168.1.20:4178" },
  );
});
test("a phone already using the server's private address keeps that working route", () => {
  assert.deepEqual(
    roomConnection({
      host: "192.168.1.20:4178",
      configuredMode: "internet",
      playMode: "same-wifi",
      addresses: ["http://10.8.0.1:4178"],
    }),
    { mode: "lan", inviteOrigin: "http://192.168.1.20:4178" },
  );
});
test("a hosted Same Wi-Fi room stays on the hosted service and exposes no internal addresses", () => {
  assert.deepEqual(
    roomConnection({
      host: "heir.example.com",
      configuredMode: "internet",
      playMode: "same-wifi",
      addresses: ["http://10.0.0.8:3000"],
    }),
    { mode: "internet", inviteOrigin: null },
  );
});
test("local creation without a Wi-Fi interface gives a connection instruction, not an address form", () => {
  assert.throws(
    () =>
      roomConnection({
        host: "localhost:4178",
        configuredMode: "internet",
        playMode: "same-wifi",
        addresses: [],
      }),
    /Connect this computer to Wi-Fi/,
  );
});
