export function addConditionToSeeHideContent(canSee: boolean) {
  return canSee
    ? {
        $or: [{ hide: false }, { hide: true }],
      }
    : { hide: false, password: undefined }
}

export const addYearCondition = (year?: number) => {
  if (!year) {
    return {}
  }
  return {
    created: {
      $gte: new Date(year, 1, 1),
      $lte: new Date(year + 1, 1, 1),
    },
  }
}
