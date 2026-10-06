{ pkgs ? import <nixpkgs> { } }:
let
  linuxPkgs = with pkgs; lib.optional stdenv.isLinux (
    inotify-tools
  );
in
with pkgs;
mkShell {
  nativeBuildInputs = [
    nodejs_22
    (pnpm_11.override { nodejs-slim = nodejs-slim_22; })

    # custom pkg groups
    linuxPkgs
  ];
}
