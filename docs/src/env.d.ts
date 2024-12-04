/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />
/// <reference types="@astrojs/starlight/virtual" />

declare namespace App {
  interface Locals {
    starlight: import('@astrojs/starlight/props').Props;
  }
}
