declare module "@prisma/nextjs-monorepo-workaround-plugin" {
  /** Copies Prisma's query engine next to server bundles in monorepos. */
  export class PrismaPlugin {
    apply(compiler: unknown): void;
  }
}
