/* Temporary type shims to unblock TypeScript until packages are installed.
   Remove this file after running:
     npm install three @react-three/fiber @react-three/drei
*/

declare module '@react-three/fiber' {
  export const Canvas: any;
  export const useFrame: any;
  export type RootState = any;
}

declare module '@react-three/drei' {
  export const OrbitControls: any;
  export const Center: any;
  export function useGLTF(path: string, useDraco?: boolean): any;
  export namespace useGLTF {
    function preload(path: string): void;
  }
}

declare module 'three' {
  const Three: any;
  export = Three;
}

// Allow R3F JSX intrinsic elements before types are available
declare namespace JSX {
  interface IntrinsicElements {
    primitive: any;
    group: any;
    ambientLight: any;
    directionalLight: any;
  }
}
