/// <reference types="vite/client" />

// This tells TypeScript: "Hey, if I import something ending in .md?raw, 
// treat it as a plain string."
declare module '*.md?raw' {
  const content: string;
  export default content;
}