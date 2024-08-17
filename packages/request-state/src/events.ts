export type State = Map<string, unknown>;

export class ServerStateLoaded extends Event {
  public static NAME = '@it-astro:server-state-loaded' as const;

  public constructor(
    /**
     * The client state before loading the server state.
     *
     * On first load, this will be an empty map.
     * When using View Transitions and navigating to another page,
     * this will be state of the previous page.
     */
    readonly previousState: State,

    /**
     * The server state that will be loaded.
     */
    readonly serverState: State,
    options?: EventInit
  ) {
    super(ServerStateLoaded.NAME, options);
  }
}
