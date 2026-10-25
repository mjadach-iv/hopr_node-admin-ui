{ pkgs ? import <nixpkgs> { } }:
let
  linuxPkgs = with pkgs; lib.optional stdenv.isLinux (
    inotify-tools
  );
in
with pkgs;
mkShell {
  nativeBuildInputs = [
    nodejs_24
    (pnpm_11.override { nodejs-slim = nodejs-slim_24; })

    # custom pkg groups
    linuxPkgs
  ];
}
