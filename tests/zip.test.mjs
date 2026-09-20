import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { makeZip, crc32 } from "../src/shared/zip.js";

test("crc32 trifft den bekannten Wert", () => {
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
});

test("das erzeugte ZIP ist für fremde Werkzeuge lesbar", () => {
  const zip = makeZip([
    { name: "index.html", content: "<h1>Hallo</h1>" },
    { name: "unterordner/daten.json", content: JSON.stringify({ a: 1 }) },
    { name: "umlaute-äöü.txt", content: "Straße" },
  ]);

  const dir = mkdtempSync(join(tmpdir(), "zip-test-"));
  const file = join(dir, "test.zip");
  writeFileSync(file, Buffer.from(zip));

  /* Gegenprobe mit einer unabhaengigen Umsetzung: Pythons zipfile. */
  const output = execFileSync("python3", ["-c", `
import zipfile, sys
z = zipfile.ZipFile(sys.argv[1])
assert z.testzip() is None, "defekt"
print("|".join(z.namelist()))
print(z.read("index.html").decode())
print(z.read("umlaute-äöü.txt").decode())
`, file], { encoding: "utf8" }).trim().split("\n");

  assert.equal(output[0], "index.html|unterordner/daten.json|umlaute-äöü.txt");
  assert.equal(output[1], "<h1>Hallo</h1>");
  assert.equal(output[2], "Straße");
});
