{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs }: {
    devShells.x86_64-linux = nixpkgs.mkShell {
      buildInputs = with nixpkgs; [
        nodejs_20
        electron
      ];

      ELECTRON_SKIP_BINARY_DOWNLOAD = "1";
      ELECTRON_OVERRIDE_DIST_PATH = "${electron}/libexec/electron";
    };
  };
}