export enum LinkType {
  Friend,
  Collection,
}

export enum LinkState {
  Pass,
  Audit,
  Outdate,
  Banned,
  Reject,
}

export const LinkStateMap = {
  [LinkState.Pass]: 'Approved',
  [LinkState.Audit]: 'Pending review',
  [LinkState.Outdate]: 'Outdated',
  [LinkState.Banned]: 'Banned',
  [LinkState.Reject]: 'Rejected',
}
