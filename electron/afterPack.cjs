// electron-builder afterPack hook, see electron-builder.yml. Runs before signing.
//
// macOS Local Network privacy tells programs apart by their Mach-O UUID, not by bundle ID or
// signature (Apple TN3179). The executables of the prebuilt Electron binary keep Electron's UUIDs,
// which every app on the same Electron version shares, e.g. the Electron of `pnpm electron:dev`.
// macOS then applies another app's Local Network rule to ours and blocks nodes on the local network
// even with the toggle on. So the main and helper executables get UUIDs of their own, derived from
// the app ID, version, file and architecture, so rebuilding a version gives the same UUIDs.

const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const FAT_MAGIC = 0xcafebabe;
const FAT_MAGIC_64 = 0xcafebabf;
const MH_MAGIC_64 = 0xfeedfacf;
const LC_UUID = 0x1b;

/** Offsets and CPU types of the architectures in a universal (fat) or single architecture Mach-O. */
const slicesOf = (data) => {
  const magic = data.readUInt32BE(0);
  if (magic !== FAT_MAGIC && magic !== FAT_MAGIC_64) return [{ offset: 0, cpuType: data.readUInt32LE(4) }];
  const slices = [];
  for (let i = 0; i < data.readUInt32BE(4); i++) {
    if (magic === FAT_MAGIC) {
      const entry = 8 + i * 20;
      slices.push({ offset: data.readUInt32BE(entry + 8), cpuType: data.readUInt32BE(entry) });
    } else {
      const entry = 8 + i * 32;
      slices.push({ offset: Number(data.readBigUInt64BE(entry + 8)), cpuType: data.readUInt32BE(entry) });
    }
  }
  return slices;
};

/** Offset of the 16 UUID bytes of the LC_UUID load command of the slice. */
const uuidOffsetOf = (data, slice, file) => {
  if (data.readUInt32LE(slice.offset) !== MH_MAGIC_64) throw new Error(`${file} is not a 64-bit Mach-O`);
  const commandCount = data.readUInt32LE(slice.offset + 16);
  let command = slice.offset + 32;
  for (let i = 0; i < commandCount; i++) {
    if (data.readUInt32LE(command) === LC_UUID) return command + 8;
    command += data.readUInt32LE(command + 4);
  }
  throw new Error(`${file} has no LC_UUID`);
};

const setUniqueUuids = (file, seed) => {
  const data = fs.readFileSync(file);
  for (const slice of slicesOf(data)) {
    const uuid = crypto
      .createHash('sha256')
      .update(`${seed}\0${path.basename(file)}\0${slice.cpuType}`)
      .digest()
      .subarray(0, 16);
    // a name based UUID (version 5 and RFC 4122 variant bits), like the ones linkers write
    uuid[6] = (uuid[6] & 0x0f) | 0x50;
    uuid[8] = (uuid[8] & 0x3f) | 0x80;
    uuid.copy(data, uuidOffsetOf(data, slice, file));
  }
  fs.writeFileSync(file, data);
};

exports.default = async (context) => {
  if (context.electronPlatformName !== 'darwin') return;
  // a universal build packs each architecture into <appOutDir>-<arch>-temp first and merges them, which
  // needs both signed the same, so only the merged app is changed, when afterPack runs once more
  if (context.appOutDir.endsWith('-temp')) return;
  const { appInfo } = context.packager;
  const app = path.join(context.appOutDir, `${appInfo.productFilename}.app`);
  const frameworks = path.join(app, 'Contents', 'Frameworks');
  const executables = [
    path.join(app, 'Contents', 'MacOS', appInfo.productFilename),
    ...fs
      .readdirSync(frameworks)
      .filter((name) => name.endsWith('.app'))
      .flatMap((helper) => {
        const dir = path.join(frameworks, helper, 'Contents', 'MacOS');
        return fs.readdirSync(dir).map((name) => path.join(dir, name));
      }),
  ];
  for (const file of executables) setUniqueUuids(file, `${appInfo.id}\0${appInfo.version}`);
  // the edit breaks the signatures, and without a certificate electron-builder does not sign at all
  // (`pnpm electron:build`), so sign the app ad-hoc to keep it launchable; signing the app replaces it
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app]);
};
