{
  description = "A collection of oxygen-free tools for astronauts.";
  inputs = {
    nixpkgs.url = "github:Fryuni/nixpkgs/master";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = {
    nixpkgs,
    flake-utils,
    ...
  }:
    flake-utils.lib.eachDefaultSystem (
      system: let
        throwSystem = throw "Unsupported system: ${system}";
        pkgs = nixpkgs.legacyPackages.${system};

            browsersInfo = builtins.fromJSON (builtins.readFile "${pkgs.playwright-driver}/browsers.json");
      in {
        devShells.default = pkgs.mkShell {
          packages = [
            pkgs.nodejs_20
            pkgs.corepack_20
            pkgs.playwright
          ];

          PLAYWRIGHT_NODEJS_PATH = "${pkgs.nodejs_20}/bin/node";
          PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = true;
          PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = 1;
          PLAYWRIGHT_BROWSERS_PATH = "${pkgs.playwright-driver.browsers}";

          PLAYWRIGHT_CHROME_BIN = let
            chromeInfo = pkgs.lib.lists.findFirst (b: b.name == "chromium") (throw "value not found") browsersInfo.browsers;
            chromePath =
              {
                x86_64-linux = "chrome-linux/chrome";
                aarch64-linux = "chrome-linux/chrome";
                x86_64-darwin = "chrome-mac/Chromium.app/Contents/MacOS/Chromium";
                arm64-darwin = "chrome-mac/Chromium.app/Contents/MacOS/Chromium";
              }
              .${system}
              or throwSystem;
          in "${pkgs.playwright-driver.browsers}/chromium-${chromeInfo.revision}/${chromePath}";

          PLAYWRIGHT_FIREFOX_BIN = let
            firefoxInfo = pkgs.lib.lists.findFirst (b: b.name == "firefox") (throw "value not found") browsersInfo.browsers;
            firefoxPath =
              {
                x86_64-linux = "firefox-linux/firefox";
                aarch64-linux = "firefox-linux/firefox";
                x86_64-darwin = "firefox/Nightly.app/Contents/MacOS/firefox";
                arm64-darwin = "firefox/Nightly.app/Contents/MacOS/firefox";
              }
              .${system}
              or throwSystem;
          in "${pkgs.playwright-driver.browsers}/firefox-${firefoxInfo.revision}/${firefoxPath}";
        };

        formatter = pkgs.alejandra;
      }
    );
}
