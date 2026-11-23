import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSocketIp } from "./ip-utils.js";
import { sharedIpSocketIds } from "./shared-ip.js";

test("oznaci samo igrace iste IP adrese", () => {
  const ips = new Map([
    ["a", "203.0.113.10"],
    ["b", "203.0.113.10"],
    ["c", "198.51.100.5"],
    ["d", "192.0.2.7"],
  ]);
  assert.deepEqual([...sharedIpSocketIds(["a", "b", "c", "d"], ips)].sort(), ["a", "b"]);
});

test("ne oznacava igrace iz drugih soba", () => {
  const ips = new Map([
    ["a", "203.0.113.10"],
    ["b", "203.0.113.10"],
    ["c", "198.51.100.5"],
  ]);
  assert.equal(sharedIpSocketIds(["a", "c"], ips).size, 0);
});

test("nepoznate adrese se ne usporeduju", () => {
  assert.equal(sharedIpSocketIds(["a", "b"], new Map()).size, 0);
});

test("IPv4 mapped IPv6 i localhost se normaliziraju", () => {
  assert.equal(normalizeSocketIp("::ffff:192.0.2.1"), "192.0.2.1");
  assert.equal(normalizeSocketIp("::1"), "127.0.0.1");
  assert.equal(normalizeSocketIp("not-an-ip"), null);
});
