export interface FilterSettings {
  filterCommands: boolean
  filterOthersItems: boolean
  filterJoinLeaves: boolean
}

const DEFAULT_FILTER_SETTINGS: FilterSettings = {
  filterCommands: false,
  filterOthersItems: false,
  filterJoinLeaves: false,
}

export function parseFilterSettings(value: string): FilterSettings {
  const parsed: unknown = JSON.parse(value)

  if (typeof parsed !== 'object' || parsed === null) {
    return DEFAULT_FILTER_SETTINGS
  }

  const settings = parsed as Record<string, unknown>

  return {
    filterCommands:
      typeof settings.filterCommands === 'boolean'
        ? settings.filterCommands
        : DEFAULT_FILTER_SETTINGS.filterCommands,
    filterOthersItems:
      typeof settings.filterOthersItems === 'boolean'
        ? settings.filterOthersItems
        : DEFAULT_FILTER_SETTINGS.filterOthersItems,
    filterJoinLeaves:
      typeof settings.filterJoinLeaves === 'boolean'
        ? settings.filterJoinLeaves
        : DEFAULT_FILTER_SETTINGS.filterJoinLeaves,
  }
}
