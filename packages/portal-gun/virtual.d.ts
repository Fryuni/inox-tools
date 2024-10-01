type PortalAttrs = {
  to?: string;
  name?: string;
  children?: any;
};

declare namespace JSX {
  interface IntrinsicElements {
    portal: PortalAttrs;
  }
}

import 'preact';

declare module 'preact' {
  export namespace JSX {
    export interface IntrinsicElements {
      portal: PortalAttrs;
    }
  }
}
